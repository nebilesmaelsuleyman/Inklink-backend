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

export type WorkAggregateChapterInput = {
 _id: any;
 title: string;
 summary?: string;
 coverImage?: string;
 orderIndex: number;
 moderationStatus: ChapterModerationStatus;
 moderationUpdatedAt?: Date;
 moderationConfidence?: number;
 moderationReason?: string;
 childSafe?: boolean;
 adultSafe?: boolean;
 updatedAt?: Date;
};

export type WorkAggregateResult = {
 derivedStatus: DerivedWorkStatus;
 childSafe?: boolean;
 adultSafe?: boolean;
 moderationUpdatedAt?: Date;
 representative?: {
   chapterId: string;
   moderationUpdatedAt?: Date;
   moderationConfidence?: number;
   moderationReason?: string;
 };
 chaptersMeta: WorkChaptersMetaEntry[];
};


export function computeNextWorkStatus(
 currentStatus: WorkStatus,
 derivedStatus: DerivedWorkStatus,
): WorkStatus {
 return currentStatus === 'published' && derivedStatus === 'approved'
   ? 'published'
   : derivedStatus;
}


function safeDate(value: any): Date | undefined {
 if (!value) return undefined;
 if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
 const asDate = new Date(value);
 return Number.isNaN(asDate.getTime()) ? undefined : asDate;
}
