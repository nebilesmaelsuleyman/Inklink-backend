import { Document, Schema, Types } from 'mongoose';

export interface ChatMessage extends Document<Types.ObjectId> {
  chatRoomId: Types.ObjectId;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ChatMessageSchema = new Schema<ChatMessage>(
  {
    chatRoomId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: true,
    },
    userId: { type: String, required: true, index: true },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: true },
);

ChatMessageSchema.index({ chatRoomId: 1, createdAt: -1 });
