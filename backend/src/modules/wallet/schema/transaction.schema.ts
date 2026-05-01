import { Document, Schema, Types } from 'mongoose';

export enum TransactionType {
  AD = 'ad',
  PREMIUM = 'premium',
  DONATION = 'donation',
  WITHDRAWAL = 'withdrawal',
}

export interface TransactionDocument extends Document {
  userId: Types.ObjectId;
  amount: number;
  type: TransactionType;
  description: string;
  createdAt: Date;
}

export const TransactionSchema = new Schema<TransactionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: Object.values(TransactionType), required: true },
    description: { type: String, required: true },
  },
  { timestamps: true },
);
