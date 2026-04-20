import { Schema, model } from 'mongoose';
import { Profile } from './profile.type';

export const PROFILE_MODEL_NAME = 'Profile';

export const ProfileSchema = new Schema<Profile>(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    profilePicture: { type: String },
    bio: { type: String },

    followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    likes: { type: Number, default: 0 },

    readingList: [{ type: Schema.Types.ObjectId, ref: 'Book' }],
    favoriteBook: { type: Schema.Types.ObjectId, ref: 'Book' },

    isCreator: { type: Boolean, default: false },
  },
  { timestamps: true },
);
