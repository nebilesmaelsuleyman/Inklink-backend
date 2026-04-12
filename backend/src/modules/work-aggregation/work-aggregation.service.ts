import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CHAPTER_MODEL_NAME, ChapterDocument } from '../chapters/schema/chapter.schema';
import { WORK_MODEL_NAME, WorkDocument } from '../works/schema/work.schema';
import { computeNextWorkStatus, computeWorkAggregateFromChapters } from './compute-work-aggregate';


type RecomputeOptions = {
 clearReviewed?: boolean;
 reviewedBy?: Types.ObjectId;
 reviewedAt?: Date;
};
@Injectable()
export class WorkAggregationService {

constructor(
   @InjectModel(CHAPTER_MODEL_NAME)
   private readonly chapterModel: Model<ChapterDocument>,
   @InjectModel(WORK_MODEL_NAME)
   private readonly workModel: Model<WorkDocument>,
 ) {}


 async recomputeAndPersist(workId: Types.ObjectId, options: RecomputeOptions = {}) {
   const work = await this.workModel.findById(workId).lean().exec();
   if (!work) throw new NotFoundException('Work not found');


   const chapters = await this.chapterModel
     .find({ workId })
     .select(
       'title summary coverImage orderIndex moderationStatus moderationUpdatedAt moderationConfidence moderationReason childSafe adultSafe updatedAt',
     )
     .sort({ orderIndex: 1, createdAt: 1 })
     .lean()
     .exec();


   const aggregate = computeWorkAggregateFromChapters(chapters as any);


   const nextStatus = computeNextWorkStatus(work.status as any, aggregate.derivedStatus);


   const $set: any = {
     status: nextStatus,
     chaptersMeta: aggregate.chaptersMeta,
 moderationConfidence: aggregate.representative?.moderationConfidence,
     moderationReason: aggregate.representative?.moderationReason
       ? `chapter_content:${aggregate.representative.moderationReason}`
       : undefined,
     childSafe: aggregate.childSafe,
     adultSafe: aggregate.adultSafe,
     moderationUpdatedAt: aggregate.moderationUpdatedAt,
   };


   const $unset: any = {};


   if (options.reviewedBy) {
     $set.reviewedBy = options.reviewedBy;
     $set.reviewedAt = options.reviewedAt ?? new Date();
 } else if (options.clearReviewed && nextStatus !== 'published') {
     $unset.reviewedBy = '';
     $unset.reviewedAt = '';
   }


   if ($set.moderationReason === undefined) $unset.moderationReason = '';
   if ($set.moderationConfidence === undefined) $unset.moderationConfidence = '';
   if ($set.childSafe === undefined) $unset.childSafe = '';
   if ($set.adultSafe === undefined) $unset.adultSafe = '';
   if ($set.moderationUpdatedAt === undefined) $unset.moderationUpdatedAt = '';


   const update: any = { $set };
   if (Object.keys($unset).length > 0) update.$unset = $unset;


   const updated = await this.workModel
     .findByIdAndUpdate(workId, update, { new: true })
     .lean()
     .exec();


   if (!updated) throw new NotFoundException('Work not found');
   return updated;
 }
}

