import { Document, Schema, Types } from 'mongoose';

export const YJS_SNAPSHOT_MODEL_NAME = 'YjsSnapshot';

export interface YjsSnapshotEntity extends Document {
  documentId: Types.ObjectId;
  state: Buffer;
  stateVector: Buffer;
  lastSeq: number;
  updatedAt: Date;
}

export const YjsSnapshotSchema = new Schema<YjsSnapshotEntity>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'YjsDocument',
      required: true,
      unique: true,
      index: true,
    },
    state: { type: Buffer, required: true },
    stateVector: { type: Buffer, required: true },
    lastSeq: { type: Number, required: true, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
