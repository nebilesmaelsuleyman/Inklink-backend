import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ObjectIdLike } from 'bson';
import { ChatRoomKind, ChatRoomType } from './schema/chat-room.schema';
import { ChatMembership, ChatMemberRole } from './schema/membership.schema';
import { ChatMessage } from './schema/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel('ChatRoom') private readonly ChatModel: Model<ChatRoomType>,
    @InjectModel('ChatMembership')
    private readonly membershipModel: Model<ChatMembership>,
    @InjectModel('ChatMessage')
    private readonly messageModel: Model<ChatMessage>,
  ) {}

  private asObjectId(id: ObjectIdLike | string): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return new Types.ObjectId(id as any);
  }

  private normalizeRoomType(room: Partial<ChatRoomType>): ChatRoomKind {
    const type = room.type;
    if (type === 'direct' || type === 'group' || type === 'author') {
      return type;
    }
    return 'author';
  }

  private async getMembership(chatRoomId: Types.ObjectId, userId: string) {
    return this.membershipModel.findOne({ chatRoomId, userId }).lean().exec();
  }

  private async assertRoomMember(chatRoomId: Types.ObjectId, userId: string) {
    const membership = await this.getMembership(chatRoomId, userId);
    if (!membership) {
      throw new ForbiddenException('You are not a member of this room');
    }
    return membership;
  }

  private async assertCanManageMembers(
    chatRoomId: Types.ObjectId,
    room: ChatRoomType,
    roomType: ChatRoomKind,
    actorUserId: string,
  ) {
    const membership = await this.getMembership(chatRoomId, actorUserId);

    if (roomType === 'author') {
      const isAuthorOwner = room.authorId === actorUserId;
      const hasAuthorRole = membership?.role === 'author';
      if (isAuthorOwner || hasAuthorRole) return;
      throw new ForbiddenException('Only the author can manage subscribers');
    }

    if (roomType === 'group') {
      const isAllowed = membership?.role === 'owner' || membership?.role === 'admin';
      if (isAllowed) return;
      throw new ForbiddenException('Only owner/admin can manage group members');
    }

    throw new BadRequestException('Cannot manage members in direct chat');
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
  async createGroupRoom(ownerId: string, title: string, memberIds?: string[]) {
    const owner = (ownerId || '').trim();
    const name = (title || '').trim();
    if (!owner) throw new BadRequestException('Missing ownerId');
    if (!name) throw new BadRequestException('Group name is required');

    const created = await this.ChatModel.create({
      type: 'group',
      title: name,
      createdBy: owner,
    });

    await this.ensureMembership(created._id, owner, 'owner');

    const normalizedMembers = Array.from(
      new Set((memberIds || []).map((id) => (id || '').trim()).filter(Boolean)),
    ).filter((id) => id !== owner);

    await Promise.all(
      normalizedMembers.map((memberId) =>
        this.ensureMembership(created._id, memberId, 'member'),
      ),
    );

    return created.toObject();
  }

  async addMember(
    chatRoomId: ObjectIdLike | string,
    actorUserId: string,
    memberUserId: string,
  ) {
    const roomId = this.asObjectId(chatRoomId);
    const actor = (actorUserId || '').trim();
    const member = (memberUserId || '').trim();
    if (!actor || !member) throw new BadRequestException('Missing ids');
    if (actor === member) {
      throw new BadRequestException('Cannot add yourself as a member');
    }

    const room = await this.ChatModel.findById(roomId).lean().exec();
    if (!room) throw new NotFoundException('Chat room not found');

    const roomType = this.normalizeRoomType(room);

    if (roomType === 'direct') {
      throw new BadRequestException('Cannot add members to a direct chat');
    }

    await this.assertCanManageMembers(roomId, room, roomType, actor);
    await this.ensureMembership(roomId, member, roomType === 'author' ? 'subscriber' : 'member');
    return { ok: true };
  }

  async sendMessage(
    chatRoomId: ObjectIdLike | string,
    senderUserId: string,
    content: string,
  ) {
    const roomId = this.asObjectId(chatRoomId);
    const sender = (senderUserId || '').trim();
    const body = (content || '').trim();

    if (!sender) throw new BadRequestException('Missing senderUserId');
    if (!body) throw new BadRequestException('Message content is required');

    const room = await this.ChatModel.findById(roomId).lean().exec();
    if (!room) throw new NotFoundException('Chat room not found');

    const roomType = this.normalizeRoomType(room);

    if (roomType === 'author' && room.authorId === sender) {
      await this.ensureMembership(roomId, sender, 'author');
    }

    await this.assertRoomMember(roomId, sender);

    const created = await this.messageModel.create({
      chatRoomId: roomId,
      userId: sender,
      content: body,
    });

    return created.toObject();
  }

}
