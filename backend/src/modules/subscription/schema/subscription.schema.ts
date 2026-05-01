import { Document, Schema, Types } from 'mongoose';

export const SUBSCRIPTION_MODEL_NAME = 'Subscription';

export type SubscriptionPlan = 'weekly' | 'monthly' | 'yearly';
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled';

export interface SubscriptionDocument extends Document {
  userId: Types.ObjectId;
  plan: SubscriptionPlan;
  price: number;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  txRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SubscriptionSchema = new Schema<SubscriptionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['weekly', 'monthly', 'yearly'],
      required: true,
    },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'active', 'expired', 'cancelled'],
      default: 'pending',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    txRef: { type: String, required: false, index: true },
  },
  { timestamps: true },
);

SubscriptionSchema.index({ userId: 1, status: 1 });
SubscriptionSchema.index({ endDate: 1 });
