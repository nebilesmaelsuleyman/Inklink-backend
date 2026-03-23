import { Document, Schema, Types } from 'mongoose';

export interface ChatRoom extends Document<Types.ObjectId> {
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ChatRoomSchema = new Schema<ChatRoom>(
  {
    authorId: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true },
);

