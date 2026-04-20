import { Document, Schema, Types } from 'mongoose';

export const REACTION_MODEL_NAME = 'Reaction';

export interface ReactionDocument extends Document {
  chapterId: Types.ObjectId;
  userId: Types.ObjectId;
  type: 'like' | 'comment';
  text?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ReactionSchema = new Schema<ReactionDocument>(
  {
    chapterId: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: { type: String, enum: ['like', 'comment'], required: true },
    text: { type: String, required: false },
  },
  { timestamps: true },
);

// One like per user per chapter; comments allow multiples.
ReactionSchema.index(
  { chapterId: 1, userId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'like' },
  },
);
