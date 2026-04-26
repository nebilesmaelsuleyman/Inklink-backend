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

      try {
        profile = await this.profileModel.create({
          _id: new Types.ObjectId(userId),
          username: user.username,
          name: user.username, // Default name to username
          bio: 'Welcome to my profile!',
          followers: [],
          likes: 0,
          isCreator: user.role === 'admin' || user.role === 'user',
        });
      } catch (error: any) {
        // If another request created the profile meanwhile, catch the duplicate key error and fetch it
        if (error.code === 11000) {
          profile = await this.profileModel
            .findById(userId)
            .populate('followers', 'username profilePicture')
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
    // Ensure the target profile exists
    const user = await this.getProfile(targetUserId);

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    // Initialize followers if missing
    if (!user.followers) {
      user.followers = [];
    }

    const isAlreadyFollowing = user.followers.some(
      (f: any) => f.toString() === currentUserId,
    );

    if (!isAlreadyFollowing) {
      user.followers.push(new Types.ObjectId(currentUserId) as any);
      await this.profileModel.updateOne(
        { _id: new Types.ObjectId(targetUserId) },
        { $push: { followers: new Types.ObjectId(currentUserId) } },
      );
    }

    return user;
  }
}
