import { Document, Schema, Types } from 'mongoose';
export type ChatMemberRole =
  | 'author'
  | 'subscriber'
  | 'owner'
  | 'admin'
  | 'member';

export interface ChatMembership extends Document<Types.ObjectId> {
  chatRoomId: Types.ObjectId;
  userId: string;
  role: ChatMemberRole;
  createdAt: Date;
  updatedAt: Date;
}

export const ChatMembershipSchema = new Schema<ChatMembership>(
  {
    chatRoomId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatRoom',
      required: true,
    },
    userId: { type: String, required: true },
    role: {
      type: String,
      enum: ['author', 'subscriber', 'owner', 'admin', 'member'],
      required: true,
    },
  },
  { timestamps: true },
);

ChatMembershipSchema.index({ chatRoomId: 1, userId: 1 }, { unique: true });
ChatMembershipSchema.index({ userId: 1 });
