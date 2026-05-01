import { Document, Schema, Types } from 'mongoose';

export const CHAPTER_READ_MODEL_NAME = 'ChapterRead';

export interface ChapterReadDocument extends Document {
  userId: Types.ObjectId;
  chapterId: Types.ObjectId;
  workId: Types.ObjectId;
  authorId: Types.ObjectId;
  readPercentage: number;
  accessType: 'subscription' | 'purchase' | 'free';
  qualified: boolean;
  createdAt: Date;
}

export const ChapterReadSchema = new Schema<ChapterReadDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chapterId: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true,
    },
    workId: {
      type: Schema.Types.ObjectId,
      ref: 'Work',
      required: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    readPercentage: { type: Number, default: 0, min: 0, max: 100 },
    accessType: {
      type: String,
      enum: ['subscription', 'purchase', 'free'],
      required: true,
    },
    qualified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One read record per user per chapter (upserted on progress updates)
ChapterReadSchema.index({ userId: 1, chapterId: 1 }, { unique: true });
// For monthly payout aggregation: find all qualified subscription reads per author
ChapterReadSchema.index({ accessType: 1, qualified: 1, authorId: 1 });
