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
      .populate('following', 'username profilePicture')
      .populate('readingList')
      .populate('favoriteBook');

    if (!profile) {
      // Create a default profile if not found
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new NotFoundException('User not found, cannot create profile');
      }

      try {
        profile = await this.profileModel.create({
          _id: new Types.ObjectId(userId),
          username: user.username,
          name: user.username, // Default name to username
          bio: 'Welcome to my profile!',
          followers: [],
          following: [],
          likes: 0,
          isCreator: user.role === 'admin' || user.role === 'user',
        });
      } catch (error: any) {
        // If another request created the profile meanwhile, catch the duplicate key error and fetch it
        if (error.code === 11000) {
          profile = await this.profileModel
            .findById(userId)
            .populate('followers', 'username profilePicture')
            .populate('following', 'username profilePicture')
            .populate('readingList')
            .populate('favoriteBook');

          if (!profile) {
            throw new Error(
              'Failed to retrieve profile after duplicate key error',
            );
          }
        } else {
          throw error;
        }
      }
    }

    return {
      ...profile.toObject(),
      followersCount: profile.followers?.length || 0,
      followingCount: profile.following?.length || 0,
      creatorDashboard: profile.isCreator ? `/creator/${profile._id}` : null,
    };
  }

  /**
   * Updates profile information and optionally user credentials.
   * @param userId ID of the user performing the update.
   * @param updates Object containing the fields to update.
   */
  async updateProfile(userId: string, updates: any) {
    // If username or password is provided, update the User model
    if (updates.username || updates.password) {
      const userUpdates: any = {};
      if (updates.username) userUpdates.username = updates.username;
      if (updates.password) userUpdates.password = updates.password;

      await this.usersService.update(userId, userUpdates);
    }

    // Update the profile model
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
    if (currentUserId === targetUserId) {
      throw new Error('You cannot follow yourself');
    }

    // Ensure target profile exists
    const targetProfile = await this.profileModel.findById(targetUserId);
    if (!targetProfile) {
      throw new NotFoundException('Target user profile not found');
    }

    // Ensure actor profile exists
    const actorProfile = await this.profileModel.findById(currentUserId);
    if (!actorProfile) {
      throw new NotFoundException('Your profile not found');
    }

    const isAlreadyFollowing = targetProfile.followers.some(
      (f: any) => f.toString() === currentUserId,
    );

    if (isAlreadyFollowing) {
      // Unfollow
      await this.profileModel.updateOne(
        { _id: new Types.ObjectId(targetUserId) },
        { $pull: { followers: new Types.ObjectId(currentUserId) } },
      );
      await this.profileModel.updateOne(
        { _id: new Types.ObjectId(currentUserId) },
        { $pull: { following: new Types.ObjectId(targetUserId) } },
      );
    } else {
      // Follow
      await this.profileModel.updateOne(
        { _id: new Types.ObjectId(targetUserId) },
        { $push: { followers: new Types.ObjectId(currentUserId) } },
      );
      await this.profileModel.updateOne(
        { _id: new Types.ObjectId(currentUserId) },
        { $push: { following: new Types.ObjectId(targetUserId) } },
      );
    }

    return this.getProfile(targetUserId);
  }
}
