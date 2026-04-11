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
   return this.configService.get<number>('moderation.requestTimeoutMs') || 6000;
 }

 private get safeConfidenceThreshold() {
   return (
     this.configService.get<number>('moderation.safeConfidenceThreshold') || 0.88
   );
 }

  private get unsafeConfidenceThreshold() {
   return (
     this.configService.get<number>('moderation.unsafeConfidenceThreshold') ||
     0.88
   );
 }

 async ready(): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(`${this.baseUrl}/ready`, {
    method: 'GET',
    signal: AbortSignal.timeout(Math.min(this.timeoutMs, 3000)),
  }).catch(() => null);


  if (!response || !response.ok) {
    return { ok: false, message: 'moderation_service_unavailable' };
  }


  const payload = (await response.json().catch(() => null)) as
    | { ready?: boolean; message?: string }
    | null;
  if (payload && payload.ready === false) {
    return { ok: false, message: payload.message || 'not_ready' };
  }


  return { ok: true, message: payload?.message || 'ready' };
}


 async moderateText(text: string): Promise<ModerationResult> {
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


   const response = await fetch(`${this.baseUrl}/moderate`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ text: bodyText }),
     signal: AbortSignal.timeout(this.timeoutMs),
   }).catch(() => null);


   if (!response || !response.ok) {
     throw new ServiceUnavailableException('Moderation service unavailable');
   }


   const payload = (await response.json()) as {
     child_safe?: boolean;
     adult_safe?: boolean;
     confidence?: number;
   };


   const childSafe = Boolean(payload.child_safe);
   const adultSafe = Boolean(payload.adult_safe);
   const confidence = Number(payload.confidence || 0);


   const anyUnsafe = !childSafe || !adultSafe;
if (!anyUnsafe && confidence >= this.safeConfidenceThreshold) {
     return {
       decision: 'approved',
       confidence,
       childSafe,
       adultSafe,
       reason: 'auto_approved_high_confidence_safe',
     };
   }

if (anyUnsafe && confidence >= this.unsafeConfidenceThreshold) {
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

