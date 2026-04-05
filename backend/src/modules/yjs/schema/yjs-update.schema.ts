import { Document, Schema, Types } from 'mongoose';

export const YJS_UPDATE_MODEL_NAME = 'YjsUpdate';

export interface YjsUpdateEntity extends Document {
  documentId: Types.ObjectId;
  seq: number;
  update: Buffer;
  createdAt: Date;
}

export const YjsUpdateSchema = new Schema<YjsUpdateEntity>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'YjsDocument',
      required: true,
      index: true,
    },
    seq: { type: Number, required: true },
    update: { type: Buffer, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

YjsUpdateSchema.index({ documentId: 1, seq: 1 }, { unique: true });
