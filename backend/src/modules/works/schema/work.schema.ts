import { Document, Schema, Types } from 'mongoose';

export const WORK_MODEL_NAME = 'Work';

export type WorkStatus = 'draft' | 'published';

export interface WorkDocument extends Document {
  authorId: Types.ObjectId;
  title: string;
  summary: string;
  coverImage?: string;
  tags: string[];
  status: WorkStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const WorkSchema = new Schema<WorkDocument>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '', trim: true },
    coverImage: { type: String, required: false },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  { timestamps: true },
);

WorkSchema.index({ authorId: 1, updatedAt: -1 });
