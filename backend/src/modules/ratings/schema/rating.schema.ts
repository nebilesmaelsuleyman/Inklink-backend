import { Document, Schema, Types } from 'mongoose';

export const RATING_MODEL_NAME = 'Rating';

export interface RatingDocument extends Document {
  workId: Types.ObjectId;
  userId: Types.ObjectId;
  value: number; // 1 to 5
  createdAt: Date;
  updatedAt: Date;
}

export const RatingSchema = new Schema<RatingDocument>(
  {
    workId: {
      type: Schema.Types.ObjectId,
      ref: 'Work',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    value: { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: true },
);

// One rating per user per work.
RatingSchema.index({ workId: 1, userId: 1 }, { unique: true });
