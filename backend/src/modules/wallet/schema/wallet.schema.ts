import { Document, Schema, Types } from 'mongoose';

export interface WalletDocument extends Document {
  userId: Types.ObjectId;
  balance: number;
  adRevenue: number;
  premiumRevenue: number;
  donationRevenue: number;
  createdAt: Date;
  updatedAt: Date;
}

export const WalletSchema = new Schema<WalletDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    balance: { type: Number, default: 0 },
    adRevenue: { type: Number, default: 0 },
    premiumRevenue: { type: Number, default: 0 },
    donationRevenue: { type: Number, default: 0 },
  },
  { timestamps: true },
);
