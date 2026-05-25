import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModerationResult } from './moderation.types';

@Injectable()
export class ModerationService {
  constructor(private readonly configService: ConfigService) {}

  private get baseUrl() {
    return (
      this.configService.get<string>('moderation.baseUrl') ||
      'http://localhost:8000'
    );
  }

  private get timeoutMs() {
    return (
      this.configService.get<number>('moderation.requestTimeoutMs') || 60000
    );
  }

  private get safeConfidenceThreshold() {
    return (
      this.configService.get<number>('moderation.safeConfidenceThreshold') ||
      0.6
    );
  }

  private get unsafeConfidenceThreshold() {
    return (
      this.configService.get<number>('moderation.unsafeConfidenceThreshold') ||
      0.6
    );
  }

  async ready(): Promise<{
    ok: boolean;
    message: string;
    mode?: 'model' | 'fallback' | 'warming_up' | 'strict' | string;
  }> {
    const response = await fetch(`${this.baseUrl}/ready`, {
      method: 'GET',
      signal: AbortSignal.timeout(Math.min(this.timeoutMs, 3000)),
    }).catch(() => null);

    if (!response || !response.ok) {
      return { ok: false, message: 'moderation_service_unavailable' };
    }

    const payload = (await response.json().catch(() => null)) as {
      ready?: boolean;
      message?: string;
      mode?: string;
    } | null;
    if (payload && payload.ready === false) {
      return {
        ok: false,
        message: payload.message || 'not_ready',
        mode: payload.mode,
      };
    }

    // "ready" may still mean "fallback" mode (e.g. model artifacts missing).
    const mode = payload?.mode;
    const ok = mode ? mode !== 'fallback' : true;
    return { ok, message: payload?.message || 'ready', mode };
  }

  async moderateText(text: string, customTimeoutMs?: number): Promise<ModerationResult> {
    const bodyText = (text || '').trim();
    if (!bodyText) {
      return {
        decision: 'approved',
        confidence: 1,
        childSafe: true,
        adultSafe: true,
        reason: 'empty_text_auto_approved',
      };
    }

    const activeTimeout = customTimeoutMs || this.timeoutMs;
    const response = await fetch(`${this.baseUrl}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: bodyText }),
      signal: AbortSignal.timeout(activeTimeout),
    }).catch(() => null);

    if (!response || !response.ok) {
      return {
        decision: 'needs_admin_review',
        confidence: 0,
        childSafe: false,
        adultSafe: false,
        reason: 'moderation_service_unavailable_fallback',
      };
    }

    const payload = (await response.json()) as {
      child_safe?: boolean;
      adult_safe?: boolean;
      confidence?: number;
      flag_for_review?: boolean;
      mode?: string;
    };

    const childSafe = Boolean(payload.child_safe);
    const adultSafe = Boolean(payload.adult_safe);
    const confidence = Number(payload.confidence || 0);
    const flagForReview = Boolean(payload.flag_for_review);
    const mode = payload.mode || '';

    // ── 1. If moderation service explicitly flags for review, respect that ──
    if (flagForReview) {
      return {
        decision: 'needs_admin_review',
        confidence,
        childSafe,
        adultSafe,
        reason: `flagged_for_review_by_moderation_service (${mode})`,
      };
    }

    // ── 2. Fallback mode: keyword-based only, low confidence is expected ──
    //    Don't apply the high confidence thresholds to fallback results.
    if (mode === 'fallback') {
      if (childSafe && adultSafe) {
        return {
          decision: 'approved',
          confidence: Math.max(confidence, 0.5),
          childSafe,
          adultSafe,
          reason: 'fallback_mode_no_flags_auto_approved',
        };
      }
      return {
        decision: 'needs_admin_review',
        confidence,
        childSafe,
        adultSafe,
        reason: 'fallback_mode_flagged_manual_review',
      };
    }

    // ── 3. Model mode: three-tier classification ──
    //   Tier 1 — Fully safe  (child_safe && adult_safe)        → approved
    //   Tier 2 — Adult-only  (!child_safe && adult_safe)       → needs_admin_review (age gate)
    //   Tier 3 — Fully toxic (!child_safe && !adult_safe)      → rejected

    // Tier 1: both safe → approve
    if (childSafe && adultSafe && confidence >= this.safeConfidenceThreshold) {
      return {
        decision: 'approved',
        confidence,
        childSafe,
        adultSafe,
        reason: 'auto_approved_high_confidence_safe',
      };
    }

    // Tier 2: adult-only content → route to admin for age-gate decision
    if (!childSafe && adultSafe) {
      return {
        decision: 'needs_admin_review',
        confidence,
        childSafe,
        adultSafe,
        reason: 'adult_only_content_requires_age_gate_review',
      };
    }

    // Tier 3: fully toxic/harmful → reject
    if (!childSafe && !adultSafe && confidence >= this.unsafeConfidenceThreshold) {
      return {
        decision: 'rejected',
        confidence,
        childSafe,
        adultSafe,
        reason: 'auto_rejected_high_confidence_unsafe',
      };
    }

    return {
      decision: 'needs_admin_review',
      confidence,
      childSafe,
      adultSafe,
      reason: 'manual_review_required_low_confidence_or_mixed',
    };
  }
}
