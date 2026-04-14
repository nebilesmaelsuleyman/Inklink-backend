import { Schema, Types } from 'mongoose';

export type ChatRoomKind = 'author' | 'direct' | 'group';

export interface ChatRoomType {
  _id: Types.ObjectId;
  type: ChatRoomKind;
  authorId?: string;
  directKey?: string;
  title?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ChatRoomSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['author', 'direct', 'group'],
      required: true,
      default: 'author',
      index: true,
    },
    authorId: { type: String, index: true },
    directKey: { type: String, index: true },
    title: { type: String, trim: true, maxlength: 100 },
    createdBy: { type: String, index: true },
  },
  { timestamps: true },
);

ChatRoomSchema.index(
  { type: 1, authorId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'author', authorId: { $exists: true } },
  },
);

ChatRoomSchema.index(
  { type: 1, directKey: 1 },
  {
    unique: true,
    partialFilterExpression: { type: 'direct', directKey: { $exists: true } },
  },
);
