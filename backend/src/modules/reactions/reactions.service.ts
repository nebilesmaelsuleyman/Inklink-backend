import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CHAPTER_MODEL_NAME, ChapterDocument } from '../chapters/schema/chapter.schema';
import { USER_MODEL_NAME, UserDocument } from '../users/user.schema';
import { WORK_MODEL_NAME, WorkDocument } from '../works/schema/work.schema';
import { CreateCommentDto } from './dto/create-comment.dto';
import { REACTION_MODEL_NAME, ReactionDocument } from './schema/reaction.schema';

type Role = 'user' | 'admin' | 'parent' | 'child';

@Injectable()
export class ReactionsService {
  constructor(
    @InjectModel(REACTION_MODEL_NAME)
    private readonly reactionModel: Model<ReactionDocument>,
    @InjectModel(CHAPTER_MODEL_NAME)
    private readonly chapterModel: Model<ChapterDocument>,
    @InjectModel(WORK_MODEL_NAME)
    private readonly workModel: Model<WorkDocument>,
    @InjectModel(USER_MODEL_NAME)
    private readonly userModel: Model<UserDocument>,
  ) {}

  private toObjectId(id: string, field = 'id') {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return new Types.ObjectId(id);
  }

  private initials(name: string) {
    const cleaned = (name || '').trim();
    if (!cleaned) return 'U';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || 'U';
    const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '') || '';
    return (first + last).toUpperCase();
  }

  private avatarDataUri(username: string) {
    const text = this.initials(username);
    const bg = '#6366F1';
    const fg = '#FFFFFF';
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
      `<rect width="40" height="40" rx="20" fill="${bg}"/>` +
      `<text x="20" y="22" font-family="Arial, sans-serif" font-size="14" text-anchor="middle" fill="${fg}">${text}</text>` +
      `</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  private async assertCanAccessChapter(
    chapterId: Types.ObjectId,
    requesterId?: string,
    role?: Role,
  ) {
    const chapter = await this.chapterModel.findById(chapterId).lean().exec();
    if (!chapter) throw new NotFoundException('Chapter not found');

    const work = await this.workModel
      .findById(chapter.workId)
      .select('status authorId childSafe')
      .lean()
      .exec();
    if (!work) throw new NotFoundException('Work not found');

    if (role === 'child' && !work.childSafe) {
      throw new ForbiddenException(
        'This work is not accessible in Children Mode',
      );
    }

    if (work.status !== 'published') {
      if (!requesterId) throw new ForbiddenException('Authentication required');
      const ownerId = this.toObjectId(requesterId, 'requesterId');
      if (work.authorId.toString() !== ownerId.toString()) {
        throw new ForbiddenException('You do not have access to this chapter');
      }
    }

    return { chapter, work };
  }

  async getChapterSummary(
    chapterId: string,
    requesterId?: string,
    role?: Role,
  ) {
    const parsedChapterId = this.toObjectId(chapterId, 'chapterId');
    await this.assertCanAccessChapter(parsedChapterId, requesterId, role);

    const [likesCount, commentsCount, viewerHasLiked] = await Promise.all([
      this.reactionModel.countDocuments({
        chapterId: parsedChapterId,
        type: 'like',
      }),
      this.reactionModel.countDocuments({
        chapterId: parsedChapterId,
        type: 'comment',
      }),
      requesterId
        ? this.reactionModel.exists({
            chapterId: parsedChapterId,
            userId: this.toObjectId(requesterId, 'requesterId'),
            type: 'like',
          })
        : Promise.resolve(null),
    ]);

    return {
      chapterId,
      likesCount,
      commentsCount,
      viewerHasLiked: Boolean(viewerHasLiked),
    };
  }

  async toggleLike(chapterId: string, requesterId: string, role?: Role) {
    const parsedChapterId = this.toObjectId(chapterId, 'chapterId');
    const parsedRequesterId = this.toObjectId(requesterId, 'requesterId');
    await this.assertCanAccessChapter(parsedChapterId, requesterId, role);

    const existing = await this.reactionModel
      .findOne({
        chapterId: parsedChapterId,
        userId: parsedRequesterId,
        type: 'like',
      })
      .select('_id')
      .lean()
      .exec();

    if (existing) {
      await this.reactionModel.deleteOne({ _id: existing._id }).exec();
    } else {
      try {
        await this.reactionModel.create({
          chapterId: parsedChapterId,
          userId: parsedRequesterId,
          type: 'like',
        });
      } catch (err: any) {
        // In case of race conditions with the partial unique index, treat as "liked already".
      }
    }

    const likesCount = await this.reactionModel.countDocuments({
      chapterId: parsedChapterId,
      type: 'like',
    });
    const viewerHasLiked = await this.reactionModel.exists({
      chapterId: parsedChapterId,
      userId: parsedRequesterId,
      type: 'like',
    });

    return {
      chapterId,
      likesCount,
      viewerHasLiked: Boolean(viewerHasLiked),
    };
  }

  async addComment(
    chapterId: string,
    requesterId: string,
    role: Role,
    dto: CreateCommentDto,
  ) {
    const parsedChapterId = this.toObjectId(chapterId, 'chapterId');
    const parsedRequesterId = this.toObjectId(requesterId, 'requesterId');
    await this.assertCanAccessChapter(parsedChapterId, requesterId, role);

    const text = (dto.text || '').trim();
    if (!text) throw new BadRequestException('text is required');
    if (text.length > 2000) {
      throw new BadRequestException('text is too long (max 2000 chars)');
    }

    const created = await this.reactionModel.create({
      chapterId: parsedChapterId,
      userId: parsedRequesterId,
      type: 'comment',
      text,
    });

    const user = await this.userModel
      .findById(parsedRequesterId)
      .select('username')
      .lean()
      .exec();
    const username = user?.username ?? 'Unknown';

    return {
      id: created._id.toString(),
      chapterId,
      userId: requesterId,
      author: username,
      avatar: this.avatarDataUri(username),
      text,
      createdAt: created.createdAt,
    };
  }

  async listComments(
    chapterId: string,
    requesterId?: string,
    role?: Role,
    params?: { limit?: string; cursor?: string },
  ) {
    const parsedChapterId = this.toObjectId(chapterId, 'chapterId');
    await this.assertCanAccessChapter(parsedChapterId, requesterId, role);

    const limitRaw = params?.limit ? Number(params.limit) : 20;
    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(50, limitRaw))
      : 20;

    const cursorId = params?.cursor ? this.toObjectId(params.cursor, 'cursor') : null;

    const query: any = {
      chapterId: parsedChapterId,
      type: 'comment',
    };
    if (cursorId) {
      query._id = { $lt: cursorId };
    }

    const comments = await this.reactionModel
      .find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasNextPage = comments.length > limit;
    const page = comments.slice(0, limit);

    const userIds = Array.from(
      new Set(page.map((c) => c.userId?.toString()).filter(Boolean)),
    ).map((id) => this.toObjectId(id, 'userId'));

    const users = await this.userModel
      .find({ _id: { $in: userIds } })
      .select('username')
      .lean()
      .exec();

    const byUserId = new Map<string, string>();
    users.forEach((u: any) => byUserId.set(u._id.toString(), u.username));

    const items = page.map((c: any) => {
      const username = byUserId.get(c.userId.toString()) ?? 'Unknown';
      return {
        id: c._id.toString(),
        chapterId,
        userId: c.userId.toString(),
        author: username,
        avatar: this.avatarDataUri(username),
        text: c.text || '',
        createdAt: c.createdAt,
      };
    });

    return {
      items,
      nextCursor: hasNextPage ? items[items.length - 1]?.id : null,
    };
  }

  async getSummariesForChapters(args: {
    chapterIds: string[];
    requesterId?: string;
  }) {
    const chapterObjectIds = (args.chapterIds || []).map((id) =>
      this.toObjectId(id, 'chapterId'),
    );
    if (chapterObjectIds.length === 0) return new Map<string, any>();

    const counts = await this.reactionModel
      .aggregate([
        {
          $match: {
            chapterId: { $in: chapterObjectIds },
            type: { $in: ['like', 'comment'] },
          },
        },
        {
          $group: {
            _id: { chapterId: '$chapterId', type: '$type' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    const byChapterId = new Map<string, { likesCount: number; commentsCount: number; viewerHasLiked: boolean }>();
    chapterObjectIds.forEach((oid) =>
      byChapterId.set(oid.toString(), {
        likesCount: 0,
        commentsCount: 0,
        viewerHasLiked: false,
      }),
    );

    counts.forEach((row: any) => {
      const chapterId = row._id.chapterId.toString();
      const type = row._id.type;
      const entry = byChapterId.get(chapterId);
      if (!entry) return;
      if (type === 'like') entry.likesCount = row.count;
      if (type === 'comment') entry.commentsCount = row.count;
    });

    if (args.requesterId) {
      const likerId = this.toObjectId(args.requesterId, 'requesterId');
      const liked = await this.reactionModel
        .find({
          chapterId: { $in: chapterObjectIds },
          userId: likerId,
          type: 'like',
        })
        .select('chapterId')
        .lean()
        .exec();

      liked.forEach((doc: any) => {
        const entry = byChapterId.get(doc.chapterId.toString());
        if (entry) entry.viewerHasLiked = true;
      });
    }

    return byChapterId;
  }
}
