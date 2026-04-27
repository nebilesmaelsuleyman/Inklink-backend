import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  NotificationDocument,
  NotificationType,
  NOTIFICATION_MODEL_NAME,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(NOTIFICATION_MODEL_NAME)
    private notificationModel: Model<NotificationDocument>,
  ) {}

  async getUserNotifications(userId: string) {
    const notifications = await this.notificationModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    // Map to the frontend structure
    const updates = notifications
      .filter((n) => n.type === NotificationType.CHAPTER || n.type === NotificationType.ANNOUNCEMENT)
      .map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        description: n.description,
        isRead: n.isRead,
        authorName: n.metadata?.authorName,
        authorImage: n.metadata?.authorImage,
        bookTitle: n.metadata?.bookTitle,
        bookImage: n.metadata?.bookImage,
        timestamp: n.createdAt,
      }));

    const messages = notifications
      .filter((n) => n.type === NotificationType.MESSAGE)
      .map((n) => ({
        id: n._id.toString(),
        senderName: n.metadata?.senderName || n.title,
        senderImage: n.metadata?.senderImage,
        lastMessage: n.description,
        unread: !n.isRead,
        isAuthor: !!n.metadata?.isAuthor,
        timestamp: n.createdAt,
      }));

    return { updates, messages };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
      { isRead: true },
      { returnDocument: 'after' }
    );
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }

  // Helper method for seeding
  async createNotification(data: Partial<NotificationDocument>) {
    return this.notificationModel.create(data);
  }
}
