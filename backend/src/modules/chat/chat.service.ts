import { Injectable, NotFoundException} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ObjectIdLike } from 'bson';
import { ChatRoomSchema, ChatRoomType } from './schema/chat-room.schema';
import { ChatMembership, ChatMemberRole } from './schema/membership.schema';
import { ChatMessage } from './schema/message.schema';

@Injectable()
export class ChatService {
    constructor(
        @InjectModel('ChatRoomSchema') private readonly ChatModel: Model<ChatRoomType> ,
        @InjectModel('ChatMembership') private readonly membershipModel: Model<ChatMembership>,
        @InjectModel('ChatMessage') private readonly messageModel: Model<ChatMessage>,){} 

    private asObjectId(id: ObjectIdLike | string): Types.ObjectId {
        if (id instanceof Types.ObjectId) return id;
        return new Types.ObjectId(id as any);
    }

    async getRoomById(chatRoomId: ObjectIdLike) {
        const id = this.asObjectId(chatRoomId);
        const room = await this.ChatModel.findById(id).lean().exec();
        if (!room) throw new NotFoundException('Chat room not found');
        return room;
    }
     async getRoomByAuthorId(authorId: string) {
    const room = await this.ChatModel
      .findOne({
        authorId,
        $or: [{ type: 'author' }, { type: { $exists: false } }],
      })
      .lean()
      .exec();

    // Best-effort migrate legacy docs (no type) to 'author'.
    if (room && !(room as any).type) {
      try {
        await this.ChatModel
          .updateOne({ _id: room._id }, { $set: { type: 'author' } })
          .exec();
      } catch (err: any) {
        if (err?.code !== 11000) throw err;
      }
      (room as any).type = 'author';
    }

    return room;
  }
   async ensureMembership(
    chatRoomId: ObjectIdLike,
    userId: string,
    role: ChatMemberRole,
  ) {
    const id = this.asObjectId(chatRoomId);
    await this.membershipModel
      .updateOne(
        { chatRoomId: id, userId },
        { $setOnInsert: { chatRoomId: id, userId, role } },
        { upsert: true },
      )
      .exec();
  }

  async getOrCreateRoomForAuthor(authorId: string) {
    const existing = await this.ChatModel
      .findOne({
        authorId,
        $or: [{ type: 'author' }, { type: { $exists: false } }],
      })
      .lean()
      .exec();
    if (existing) {
      if (!(existing as any).type) {
        try {
          await this.ChatModel
            .updateOne({ _id: existing._id }, { $set: { type: 'author' } })
            .exec();
        } catch (err: any) {
          if (err?.code !== 11000) throw err;
        }
        (existing as any).type = 'author';
      }
      return existing;
    }

    const created = await this.ChatModel.create({ type: 'author', authorId }) as ChatRoomType & { toObject: () => any };
    await this.ensureMembership(created._id, authorId, 'author');
    return created.toObject();
  }
}
