import { Document, Schema } from 'mongoose';

export const PRICING_PLAN_MODEL_NAME = 'PricingPlan';

export interface PricingPlanDocument extends Document {
  id: string; // 'weekly', 'monthly', 'yearly'
  name: string;
  price: number;
  currency: string;
  period: string;
  days: number;
  updatedAt: Date;
}

export const PricingPlanSchema = new Schema<PricingPlanDocument>(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'ETB' },
    period: { type: String, required: true },
    days: { type: Number, required: true },
  },
  { timestamps: true },
);
