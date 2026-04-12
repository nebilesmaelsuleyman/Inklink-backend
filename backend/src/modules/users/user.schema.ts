import { Document, Schema, Types } from 'mongoose';

export const USER_MODEL_NAME = 'User';

export interface UserDocument extends Document {
  username: string;
  password: string;
  email?: string;
  role: 'user' | 'admin' | 'parent' | 'child';
  parentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = new Schema<UserDocument>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: { type: String, required: true },
    email: { type: String, required: false, trim: true, lowercase: true },
    role: {
      type: String,
      enum: ['user', 'admin', 'parent', 'child'],
      default: 'user',
    },
    parentId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
  },
  { timestamps: true },
);
