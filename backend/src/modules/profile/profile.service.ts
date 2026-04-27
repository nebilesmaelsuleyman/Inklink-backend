import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PROFILE_MODEL_NAME } from './profile.model';
import { Profile } from './profile.type';
import { UsersService } from '../users/users.service';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(PROFILE_MODEL_NAME)
    private readonly profileModel: Model<Profile>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Fetches the user profile by ID and populates relevant fields.
   * If the profile doesn't exist, it creates a default one.
   * @param userId The ID of the profile to fetch.
   * @returns Detailed profile information including followers count and dashboard link.
   */
  async getProfile(userId: string) {
    let profile = await this.profileModel
      .findById(userId)
      .populate('followers', 'username profilePicture')
      .populate('readingList')
      .populate('favoriteBook');

    if (!profile) {
      // Create a default profile if not found
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException('User not found, cannot create profile');
      }

      profile = await this.profileModel.create({
        _id: new Types.ObjectId(userId),
        username: user.username,
        name: user.username, // Default name to username
        bio: 'Welcome to my profile!',
        followers: [],
        likes: 0,
        isCreator: user.role === 'admin' || user.role === 'user',
      });
    }

    return {
      ...profile.toObject(),
      followersCount: profile.followers?.length || 0,
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
      returnDocument: 'after',
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
