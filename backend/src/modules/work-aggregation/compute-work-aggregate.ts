export type DerivedWorkStatus =
 | 'draft'
 | 'pending_moderation'
 | 'needs_admin_review'
 | 'approved'
 | 'rejected';


export type WorkStatus = DerivedWorkStatus | 'published';


export type ChapterModerationStatus =
 | 'draft'
 | 'pending_moderation'
 | 'needs_admin_review'
| 'approved'
 | 'rejected';

 export type WorkChaptersMetaEntry = {
 chapterId: string;
 title: string;
 summary: string;
 coverImage?: string;
 orderIndex: number;
 moderationStatus: ChapterModerationStatus;
 moderationUpdatedAt?: Date;
};
