import { Document, Schema, Types } from 'mongoose';

export const CHAPTER_PURCHASE_MODEL_NAME = 'ChapterPurchase';

export interface ChapterPurchaseDocument extends Document {
  userId: Types.ObjectId;
  chapterId: Types.ObjectId;
  workId: Types.ObjectId;
  authorId: Types.ObjectId;
  price: number;
  authorShare: number;
  platformShare: number;
  createdAt: Date;
}

export const ChapterPurchaseSchema = new Schema<ChapterPurchaseDocument>(
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
      index: true,
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
    price: { type: Number, required: true },
    authorShare: { type: Number, required: true },
    platformShare: { type: Number, required: true },
  },
  { timestamps: true },
);

// One purchase per user per chapter
ChapterPurchaseSchema.index({ userId: 1, chapterId: 1 }, { unique: true });
