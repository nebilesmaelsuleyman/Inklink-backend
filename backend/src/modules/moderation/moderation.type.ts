export type ModerationStatus =
 | 'draft'
 | 'pending_moderation'
 | 'needs_admin_review'
 | 'approved'
 | 'rejected'
 | 'published';


export type ModerationDecision = 'approved' | 'rejected' | 'needs_admin_review';


export type ModerationResult = {
 decision: ModerationDecision;
 confidence: number;
 childSafe: boolean;
 adultSafe: boolean;
 reason: string;
};
