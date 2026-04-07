import { Types } from "mongoose";

export interface Profile {
  name: string;
  username: string;
  profilePicture?: string;
  bio?: string;

  followers: Types.ObjectId[];
  likes: number;

  readingList: Types.ObjectId[];
  favoriteBook?: Types.ObjectId;

  isCreator: boolean;
}