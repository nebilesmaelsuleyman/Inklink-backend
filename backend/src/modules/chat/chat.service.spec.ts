import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('ChatService', () => {
  let service: ChatService;
  const chatRoomModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
    updateOne: jest.fn(),
    create: jest.fn(),
  };
  const membershipModel = {
    updateOne: jest.fn(),
  };
  const messageModel = {};

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getModelToken('ChatRoom'), useValue: chatRoomModel },
        { provide: getModelToken('ChatMembership'), useValue: membershipModel },
        { provide: getModelToken('ChatMessage'), useValue: messageModel },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getRoomById throws when missing', async () => {
    const id = new Types.ObjectId();
    chatRoomModel.findById.mockReturnValue({
      lean: () => ({ exec: async () => null }),
    });
    await expect(service.getRoomById(id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getRoomById returns room when found', async () => {
    const id = new Types.ObjectId();
    const room = { _id: id, type: 'author', authorId: 'u1' };
    chatRoomModel.findById.mockReturnValue({
      lean: () => ({ exec: async () => room }),
    });
    await expect(service.getRoomById(id)).resolves.toEqual(room);
  });

  it('getRoomByAuthorId migrates legacy room without type', async () => {
    const room: any = { _id: new Types.ObjectId(), authorId: 'u1' };
    chatRoomModel.findOne.mockReturnValue({
      lean: () => ({ exec: async () => room }),
    });
    chatRoomModel.updateOne.mockReturnValue({ exec: async () => ({}) });

    const result = await service.getRoomByAuthorId('u1');
    expect(result).toBeTruthy();
    expect((result as any).type).toBe('author');
    expect(chatRoomModel.updateOne).toHaveBeenCalledWith(
      { _id: room._id },
      { $set: { type: 'author' } },
    );
  });

  it('ensureMembership upserts by (chatRoomId,userId)', async () => {
    const chatRoomId = new Types.ObjectId();
    membershipModel.updateOne.mockReturnValue({ exec: async () => ({}) });

    await service.ensureMembership(chatRoomId, 'u1', 'member');

    expect(membershipModel.updateOne).toHaveBeenCalledWith(
      { chatRoomId, userId: 'u1' },
      { $setOnInsert: { chatRoomId, userId: 'u1', role: 'member' } },
      { upsert: true },
    );
  });

  it('getOrCreateRoomForAuthor returns existing room', async () => {
    const existing: any = {
      _id: new Types.ObjectId(),
      type: 'author',
      authorId: 'u1',
    };
    chatRoomModel.findOne.mockReturnValue({
      lean: () => ({ exec: async () => existing }),
    });

    await expect(service.getOrCreateRoomForAuthor('u1')).resolves.toEqual(
      existing,
    );
    expect(chatRoomModel.create).not.toHaveBeenCalled();
  });

  it('getOrCreateRoomForAuthor creates room and membership when missing', async () => {
    chatRoomModel.findOne.mockReturnValue({
      lean: () => ({ exec: async () => null }),
    });
    membershipModel.updateOne.mockReturnValue({ exec: async () => ({}) });

    const createdId = new Types.ObjectId();
    chatRoomModel.create.mockResolvedValue({
      _id: createdId,
      toObject: () => ({ _id: createdId, type: 'author', authorId: 'u1' }),
    });

    const room = await service.getOrCreateRoomForAuthor('u1');
    expect(room).toEqual({ _id: createdId, type: 'author', authorId: 'u1' });
    expect(chatRoomModel.create).toHaveBeenCalledWith({
      type: 'author',
      authorId: 'u1',
    });
    expect(membershipModel.updateOne).toHaveBeenCalledTimes(1);
  });
});
