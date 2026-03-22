import { Schema, Document } from 'mongoose';

export interface YDocument extends Document {
  roomName: string;
  state: Buffer;
  updatedAt: Date;
}

export const YDocumentSchema = new Schema<YDocument>({
  roomName: { type: String, required: true, unique: true },
  state: { type: Buffer, required: true },
  updatedAt: { type: Date, default: Date.now },
});
