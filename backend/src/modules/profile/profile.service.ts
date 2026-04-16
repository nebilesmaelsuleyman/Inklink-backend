import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PROFILE_MODEL_NAME } from './profile.model';
import { Profile } from './profile.type';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(PROFILE_MODEL_NAME)
    private readonly profileModel: Model<Profile>,
  ) {}

  /**
   * Fetches the user profile by ID and populates relevant fields.
   * @param userId The ID of the profile to fetch.
   * @returns Detailed profile information including followers count and dashboard link.
   */
  async getProfile(userId: string) {
    const profile = await this.profileModel
      .findById(userId)
      .populate('followers', 'username profilePicture')
      .populate('readingList')
      .populate('favoriteBook');

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return {
      ...profile.toObject(),
      followersCount: profile.followers.length,
      creatorDashboard: profile.isCreator ? `/creator/${profile._id}` : null,
    };
  }

  /**
   * Updates basic profile information.
   * @param userId ID of the user performing the update.
   * @param updates Object containing the fields to update.
   */
  async updateProfile(userId: string, updates: Partial<Profile>) {
    return await this.profileModel.findByIdAndUpdate(userId, updates, {
      new: true,
    });
  }

  /**
   * Allows a user to follow another user.
   * @param currentUserId ID of the follower.
   * @param targetUserId ID of the user being followed.
   */
  async followUser(currentUserId: string, targetUserId: string) {

    const user = await this.profileModel.findById(targetUserId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.followers.includes(currentUserId as any)) {
      user.followers.push(currentUserId as any);
      await user.save();
    }

    return user;
  }
}