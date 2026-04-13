import { Document, Schema, Types } from 'mongoose';

export const YJS_DOCUMENT_MODEL_NAME = 'YjsDocument';

export interface YjsDocumentEntity extends Document {
  chapterId: Types.ObjectId;
  workId: Types.ObjectId;
  ownerId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const YjsDocumentSchema = new Schema<YjsDocumentEntity>(
  {
    chapterId: {
      type: Schema.Types.ObjectId,
      ref: 'Chapter',
      required: true,
      unique: true,
      index: true,
    },
    workId: {
      type: Schema.Types.ObjectId,
      ref: 'Work',
      required: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);
