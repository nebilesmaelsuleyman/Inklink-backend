import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CHAPTER_MODEL_NAME, ChapterDocument } from '../chapters/schema/chapter.schema';
import { WORK_MODEL_NAME, WorkDocument } from '../works/schema/work.schema';
// import { computeNextWorkStatus, computeWorkAggregateFromChapters } from './compute-work-aggregate';


type RecomputeOptions = {
 clearReviewed?: boolean;
 reviewedBy?: Types.ObjectId;
 reviewedAt?: Date;
};
@Injectable()
export class WorkAggregationService {}