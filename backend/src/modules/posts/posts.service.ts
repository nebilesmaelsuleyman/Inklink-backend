import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { POST_MODEL_NAME, PostDocument } from './schema/post.schema';
import { CreatePostDto } from './dto/create-post.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PROFILE_MODEL_NAME } from '../profile/profile.model';
import { Profile } from '../profile/profile.type';
import { NotificationType } from '../notifications/schemas/notification.schema';

@Injectable()
export class PostsService {
  constructor(
    @InjectModel(POST_MODEL_NAME)
    private readonly postModel: Model<PostDocument>,
    @InjectModel(PROFILE_MODEL_NAME)
    private readonly profileModel: Model<Profile>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(authorId: string, createPostDto: CreatePostDto) {
    const post = await this.postModel.create({
      authorId: new Types.ObjectId(authorId),
      content: createPostDto.content,
    });

    // Notify followers
    const authorProfile = await this.profileModel.findById(authorId);
    if (authorProfile && authorProfile.followers && authorProfile.followers.length > 0) {
      const notificationPromises = authorProfile.followers.map((followerId) =>
        this.notificationsService.createNotification({
          userId: followerId,
          type: NotificationType.ANNOUNCEMENT,
          title: `New post from ${authorProfile.username}`,
          description: createPostDto.content.substring(0, 100) + (createPostDto.content.length > 100 ? '...' : ''),
          metadata: {
            authorName: authorProfile.username,
            authorImage: authorProfile.profilePicture,
            referenceId: post._id.toString(),
          },
        } as any),
      );
      await Promise.all(notificationPromises);
    }

    return post;
  }

  async findByAuthor(authorId: string) {
    return this.postModel
      .find({ authorId: new Types.ObjectId(authorId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getFeed(userId: string) {
    // 1. Find user profile to get dismissed posts
    const userProfile = await this.profileModel.findById(userId);
    const dismissedPosts = userProfile?.dismissedPosts || [];

    // 2. Find authors the user follows
    const followedProfiles = await this.profileModel.find({
      followers: new Types.ObjectId(userId),
    });

    const followedAuthorIds = followedProfiles.map((p) => p._id);

    // 3. Get posts from these authors, excluding dismissed ones
    return this.postModel
      .find({ 
        authorId: { $in: followedAuthorIds },
        _id: { $nin: dismissedPosts }
      })
      .populate('authorId', 'username profilePicture')
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  async dismissPost(userId: string, postId: string) {
    await this.profileModel.findByIdAndUpdate(userId, {
      $addToSet: { dismissedPosts: new Types.ObjectId(postId) }
    });
    return { success: true };
  }

  async likePost(userId: string, postId: string) {
    const post = await this.postModel.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    const userObjectId = new Types.ObjectId(userId);
    const index = post.likes.indexOf(userObjectId as any);

    if (index === -1) {
      post.likes.push(userObjectId as any);
      post.likesCount += 1;

      // Notify the author
      const liker = await this.profileModel.findById(userId);
      this.notificationsService.createNotification({
        userId: post.authorId,
        type: NotificationType.ANNOUNCEMENT,
        title: `Your post was liked!`,
        description: `${liker?.username || 'Someone'} liked your post: "${post.content.substring(0, 30)}..."`,
        metadata: {
          authorName: liker?.username,
          authorImage: liker?.profilePicture,
          referenceId: post._id.toString(),
        }
      } as any).catch(err => console.error('Failed to notify author of like:', err));
    } else {
      post.likes.splice(index, 1);
      post.likesCount -= 1;
    }

    return post.save();
  }

  async delete(authorId: string, postId: string) {
    const result = await this.postModel.deleteOne({
      _id: new Types.ObjectId(postId),
      authorId: new Types.ObjectId(authorId),
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Post not found or unauthorized');
    }
    return { success: true };
  }
}
