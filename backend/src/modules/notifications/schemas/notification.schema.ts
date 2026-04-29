import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum NotificationType {
  CHAPTER = 'chapter',
  ANNOUNCEMENT = 'announcement',
  MESSAGE = 'message',
  COLLABORATION = 'collaboration',
}

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId; // recipient

  @Prop({ required: true, enum: NotificationType })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop({ type: Object })
  metadata: {
    authorName?: string;
    authorImage?: string;
    bookTitle?: string;
    bookImage?: string;
    senderName?: string;
    senderImage?: string;
    isAuthor?: boolean;
    referenceId?: string;
    [key: string]: any;
  };

  // Populated by mongoose { timestamps: true }
  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
export const NOTIFICATION_MODEL_NAME = 'Notification';
