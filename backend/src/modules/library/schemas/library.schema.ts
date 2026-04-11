import { Document, Schema, Types } from 'mongoose';

export const LIBRARY_MODEL_NAME = 'Library';

export interface CurrentlyReading {
  workId: Types.ObjectId;
  progress: number; // Percentage 0-100
}

export interface ReadingList {
  _id?: Types.ObjectId;
  name: string;
  description: string;
  works: Types.ObjectId[];
}

export interface LibraryDocument extends Document {
  userId: Types.ObjectId;
  currentlyReading: CurrentlyReading[];
  bookmarked: Types.ObjectId[];
  readLists: ReadingList[];
  createdAt: Date;
  updatedAt: Date;
}

export const LibrarySchema = new Schema<LibraryDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    currentlyReading: {
      type: [
        new Schema(
          {
            workId: {
              type: Schema.Types.ObjectId,
              ref: 'Work',
              required: true,
            },
            progress: { type: Number, default: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    bookmarked: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Work' }],
      default: [],
    },
    readLists: {
      type: [
        new Schema({
          name: { type: String, required: true },
          description: { type: String, default: '' },
          works: [{ type: Schema.Types.ObjectId, ref: 'Work' }],
        }),
      ],
      default: [],
    },
  },
  { timestamps: true },
);
