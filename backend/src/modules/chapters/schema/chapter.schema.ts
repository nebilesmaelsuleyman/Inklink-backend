import { Document, Schema, Types } from 'mongoose';

export const CHAPTER_MODEL_NAME = 'Chapter';

export type ChapterModerationStatus =
  | 'draft'
  | 'pending_moderation'
  | 'needs_admin_review'
  | 'approved'
  | 'rejected';

export interface ChapterDocument extends Document {
  workId: Types.ObjectId;
  title: string;
  orderIndex: number;
  contentText: string;
  moderationStatus: ChapterModerationStatus;
  moderationConfidence?: number;
  moderationReason?: string;
  childSafe?: boolean;
  adultSafe?: boolean;
  moderationUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const ChapterSchema = new Schema<ChapterDocument>(
  {
    workId: { type: Schema.Types.ObjectId, ref: 'Work', required: true, index: true },
    title: { type: String, required: true, trim: true },
    orderIndex: { type: Number, required: true, default: 0 },
    contentText: { type: String, default: '' },
    moderationStatus: {
      type: String,
      enum: ['draft', 'pending_moderation', 'needs_admin_review', 'approved', 'rejected'],
      default: 'draft',
    },
    moderationConfidence: { type: Number, required: false },
    moderationReason: { type: String, required: false },
    childSafe: { type: Boolean, required: false },
    adultSafe: { type: Boolean, required: false },
    moderationUpdatedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

ChapterSchema.index({ workId: 1, orderIndex: 1 }, { unique: true });
