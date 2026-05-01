import { Document, Schema, Types } from 'mongoose';

export enum CollaborationRole {
  OWNER = 'owner',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export enum CollaborationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export interface CollaborationDocument extends Document {
  workId: Types.ObjectId;
  userId: Types.ObjectId;
  role: CollaborationRole;
  status: CollaborationStatus;
  invitedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const CollaborationSchema = new Schema<CollaborationDocument>(
  {
    workId: { type: Schema.Types.ObjectId, ref: 'Work', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      enum: Object.values(CollaborationRole),
      default: CollaborationRole.EDITOR,
    },
    status: {
      type: String,
      enum: Object.values(CollaborationStatus),
      default: CollaborationStatus.PENDING,
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Unique constraint: A user can have only one collaboration record per work
CollaborationSchema.index({ workId: 1, userId: 1 }, { unique: true });
// Index for fetching a user's collaborations (invites)
CollaborationSchema.index({ userId: 1, status: 1 });
