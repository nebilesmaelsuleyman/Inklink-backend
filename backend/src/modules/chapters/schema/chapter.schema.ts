import { Document, Schema, Types } from 'mongoose';

export const CHAPTER_MODEL_NAME = 'Chapter';

export interface ChapterDocument extends Document {
  workId: Types.ObjectId;
  title: string;
  orderIndex: number;
  contentText: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ChapterSchema = new Schema<ChapterDocument>(
  {
    workId: { type: Schema.Types.ObjectId, ref: 'Work', required: true, index: true },
    title: { type: String, required: true, trim: true },
    orderIndex: { type: Number, required: true, default: 0 },
    contentText: { type: String, default: '' },
  },
  { timestamps: true },
);

ChapterSchema.index({ workId: 1, orderIndex: 1 }, { unique: true });
