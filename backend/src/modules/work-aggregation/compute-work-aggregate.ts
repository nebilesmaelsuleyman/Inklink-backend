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

function maxDate(dates: Array<Date | undefined>): Date | undefined {
 let best: Date | undefined;
 for (const date of dates) {
   if (!date) continue;
   if (!best || date.getTime() > best.getTime()) best = date;
 }
 return best;
}


function aggregateSafety(values: Array<boolean | undefined>): boolean | undefined {
 if (values.length === 0) return undefined;
 if (values.some((v) => v === false)) return false;
 if (values.some((v) => v === undefined)) return undefined;
 return true;
}



function computeDerivedStatus(chapters: WorkAggregateChapterInput[]): DerivedWorkStatus {
 if (chapters.some((c) => c.moderationStatus === 'rejected')) return 'rejected';
 if (chapters.some((c) => c.moderationStatus === 'needs_admin_review')) return 'needs_admin_review';
 if (chapters.some((c) => c.moderationStatus === 'pending_moderation')) return 'pending_moderation';
 if (chapters.length > 0 && chapters.every((c) => c.moderationStatus === 'approved')) return 'approved';
return 'draft';
}


function chapterSortKey(chapter: WorkAggregateChapterInput) {
 const orderIndex = typeof chapter.orderIndex === 'number' ? chapter.orderIndex : 0;
 const id = chapter?._id?.toString?.() ?? String(chapter?._id ?? '');
 return { orderIndex, id };
}



export function computeWorkAggregateFromChapters(
 chapters: WorkAggregateChapterInput[],
): WorkAggregateResult {
 const derivedStatus = computeDerivedStatus(chapters);


 const moderationUpdatedAt = maxDate(
   chapters.map((chapter) => safeDate(chapter.moderationUpdatedAt) ?? safeDate(chapter.updatedAt)),
 );


 const childSafe = aggregateSafety(chapters.map((c) => c.childSafe));
 const adultSafe = aggregateSafety(chapters.map((c) => c.adultSafe));


 const sorted = [...chapters].sort((a, b) => {
   const aa = chapterSortKey(a);
   const bb = chapterSortKey(b);
   if (aa.orderIndex !== bb.orderIndex) return aa.orderIndex - bb.orderIndex;
   return aa.id.localeCompare(bb.id);
 });
const chaptersMeta: WorkChaptersMetaEntry[] = sorted.map((chapter) => ({
   chapterId: chapter?._id?.toString?.() ?? String(chapter?._id ?? ''),
   title: chapter.title,
   summary: (chapter.summary ?? '').toString(),
   coverImage: chapter.coverImage,
   orderIndex: typeof chapter.orderIndex === 'number' ? chapter.orderIndex : 0,
   moderationStatus: chapter.moderationStatus,
   moderationUpdatedAt: safeDate(chapter.moderationUpdatedAt),
 }));

 const contributing = chapters.filter((c) => c.moderationStatus === derivedStatus);
 const representativePool = contributing.length > 0 ? contributing : chapters;


 let representative: WorkAggregateResult['representative'] | undefined;
 if (representativePool.length > 0) {
   const chosen = representativePool
     .map((chapter) => ({
       chapter,
       updatedAt: safeDate(chapter.moderationUpdatedAt) ?? safeDate(chapter.updatedAt),
     }))
     .sort((a, b) => (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0))[0];


   if (chosen) {
     representative = {
       chapterId: chosen.chapter?._id?.toString?.() ?? String(chosen.chapter?._id ?? ''),
       moderationUpdatedAt: safeDate(chosen.chapter.moderationUpdatedAt),
       moderationConfidence: chosen.chapter.moderationConfidence,
       moderationReason: chosen.chapter.moderationReason,
     };
   }
 }


 return {
   derivedStatus,
   childSafe,
   adultSafe,
   moderationUpdatedAt,
   representative,
   chaptersMeta,
 };
}


