import { Document, Schema, Types } from 'mongoose';

export const WORK_MODEL_NAME = 'Work';

export type WorkStatus =
  | 'draft'
  | 'pending_moderation'
  | 'needs_admin_review'
  | 'approved'
  | 'rejected'
  | 'published';

export type WorkChapterModerationStatus =
  | 'draft'
  | 'pending_moderation'
  | 'needs_admin_review'
  | 'approved'
  | 'rejected';

export interface WorkChapterMeta {
  chapterId: Types.ObjectId;
  title: string;
  summary: string;
  coverImage?: string;
  orderIndex: number;
  moderationStatus: WorkChapterModerationStatus;
  moderationUpdatedAt?: Date;
}

export interface WorkDocument extends Document {
  authorId: Types.ObjectId;
  title: string;
  summary: string;
  coverImage?: string;
  tags: string[];
  status: WorkStatus;
  chaptersMeta: WorkChapterMeta[];
  moderationConfidence?: number;
  moderationReason?: string;
  childSafe?: boolean;
  adultSafe?: boolean;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  moderationUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const WorkSchema = new Schema<WorkDocument>(
  {
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '', trim: true },
    coverImage: { type: String, required: false },
    tags: { type: [String], default: [] },
    status: {
      type: String,
      enum: [
        'draft',
        'pending_moderation',
        'needs_admin_review',
        'approved',
        'rejected',
        'published',
      ],
      default: 'draft',
    },
    chaptersMeta: {
      type: [
        new Schema(
          {
            chapterId: {
              type: Schema.Types.ObjectId,
              ref: 'Chapter',
              required: true,
            },
            title: { type: String, required: true, trim: true },
            summary: { type: String, default: '', trim: true },
            coverImage: { type: String, required: false },
            orderIndex: { type: Number, required: true },
            moderationStatus: {
              type: String,
              enum: [
                'draft',
                'pending_moderation',
                'needs_admin_review',
                'approved',
                'rejected',
              ],
              required: true,
            },
            moderationUpdatedAt: { type: Date, required: false },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    moderationConfidence: { type: Number, required: false },
    moderationReason: { type: String, required: false },
    childSafe: { type: Boolean, required: false },
    adultSafe: { type: Boolean, required: false },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    reviewedAt: { type: Date, required: false },
    moderationUpdatedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

WorkSchema.index({ authorId: 1, updatedAt: -1 });
