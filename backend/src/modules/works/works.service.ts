import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChaptersService } from '../chapters/chapters.service';
import { ModerationService } from '../moderation/moderation.service';
import { ReactionsService } from '../reactions/reactions.service';
import { CollaborationService } from '../collaboration/collaboration.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { WORK_MODEL_NAME, WorkDocument } from './schema/work.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { Profile } from '../profile/profile.type';

@Injectable()
export class WorksService {
  constructor(
    @InjectModel(WORK_MODEL_NAME)
    private readonly workModel: Model<WorkDocument>,
    private readonly chaptersService: ChaptersService,
    private readonly reactionsService: ReactionsService,
    private readonly moderationService: ModerationService,
    @Inject(forwardRef(() => CollaborationService))
    private readonly collaborationService: CollaborationService,
    private readonly notificationsService: NotificationsService,
    @InjectModel('Profile')
    private readonly profileModel: Model<Profile>,
  ) {}

  async findOneById(id: string) {
    const workId = this.toObjectId(id);
    return this.workModel.findById(workId).exec();
  }

  private toObjectId(id: string, field = 'id') {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return new Types.ObjectId(id);
  }

  private normalizeTags(tags?: string[]) {
    if (!Array.isArray(tags)) return [];
    return Array.from(
      new Set(tags.map((tag) => (tag || '').trim()).filter(Boolean)),
    );
  }

  private mapWork(work: any) {
    return {
      id: work._id.toString(),
      authorId: work.authorId.toString(),
      title: work.title,
      summary: work.summary,
      coverImage: work.coverImage,
      tags: work.tags || [],
      status: work.status,
      moderationConfidence: work.moderationConfidence,
      moderationReason: work.moderationReason,
      childSafe: work.childSafe,
      adultSafe: work.adultSafe,
      reviewedBy: work.reviewedBy ? work.reviewedBy.toString() : undefined,
      reviewedAt: work.reviewedAt,
      moderationUpdatedAt: work.moderationUpdatedAt,
      averageRating: work.averageRating || 0,
      ratingsCount: work.ratingsCount || 0,
      createdAt: work.createdAt,
      updatedAt: work.updatedAt,
    };
  }

  private async getAuthorUsernameMap(authorIds: Types.ObjectId[]) {
    if (authorIds.length === 0) return new Map<string, string>();

    const uniqueAuthorIds = Array.from(
      new Set(authorIds.map((id) => id.toString())),
    ).map((id) => new Types.ObjectId(id));

    const authors = await this.workModel.db
      .model('User')
      .find({ _id: { $in: uniqueAuthorIds } })
      .select('username')
      .lean()
      .exec();

    return new Map<string, string>(
      authors.map((author: any) => [author._id.toString(), author.username || '']),
    );
  }

  private async evaluateAndBuildModerationFields(text: string) {
    try {
      const result = await this.moderationService.moderateText(text);
      const status =
        result.decision === 'approved'
          ? 'approved'
          : result.decision === 'rejected'
            ? 'rejected'
            : 'needs_admin_review';

      return {
        status,
        moderationConfidence: result.confidence,
        moderationReason: result.reason,
        childSafe: result.childSafe,
        adultSafe: result.adultSafe,
        moderationUpdatedAt: new Date(),
        reviewedBy: undefined,
        reviewedAt: undefined,
      };
    } catch (err) {
      console.warn(
        'Moderation service failed, falling back to admin review',
        err,
      );
      return {
        status: 'needs_admin_review',
        moderationConfidence: 0,
        moderationReason:
          'Moderation service unavailable. Manual review required.',
        childSafe: false,
        adultSafe: false,
        moderationUpdatedAt: new Date(),
        reviewedBy: undefined,
        reviewedAt: undefined,
      };
    }
  }

  private async assertWorkOwner(workId: Types.ObjectId, requesterId: string) {
    const ownerId = this.toObjectId(requesterId, 'requesterId');
    const owned = await this.workModel.exists({
      _id: workId,
      authorId: ownerId,
    });
    if (!owned) {
      throw new ForbiddenException('You do not have access to this work');
    }
  }

  async create(requesterId: string, createWorkDto: CreateWorkDto) {
    const authorId = this.toObjectId(requesterId, 'requesterId');
    const title = (createWorkDto.title || '').trim();
    if (!title) throw new BadRequestException('title is required');

    const moderationFields = await this.evaluateAndBuildModerationFields(
      [title, createWorkDto.summary || ''].join('\n\n'),
    );

    const created = await this.workModel.create({
      authorId,
      title,
      summary: (createWorkDto.summary || '').trim(),
      coverImage: createWorkDto.coverImage,
      tags: this.normalizeTags(createWorkDto.tags),
      ...moderationFields,
    });

    return this.mapWork(created.toObject());
  }

  async list(requesterId: string, authorId?: string) {
    const requesterObjectId = this.toObjectId(requesterId, 'requesterId');
    const query: any = {};
    if (authorId) {
      const authorObjectId = this.toObjectId(authorId, 'authorId');
      if (authorObjectId.toString() !== requesterObjectId.toString()) {
        throw new ForbiddenException('You can only list your own works');
      }
      query.authorId = authorObjectId;
    } else {
      query.authorId = requesterObjectId;
    }

    const works = await this.workModel
      .find(query)
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    const mapped = works.map((work) => this.mapWork(work));

    // Enrich with aggregated reaction counts from chapters
    const workIds = mapped.map((w) => w.id);
    const reactionSummaries =
      await this.reactionsService.getWorkReactionSummaries(workIds);

    return mapped.map((work) => {
      const summary = reactionSummaries.get(work.id) || {
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
      };
      return { ...work, ...summary };
    });
  }

  async browse(requesterId?: string, role?: string, tag?: string) {
    const query: any = { status: 'published' };
    if (tag) {
      query.tags = tag;
    }

    if (role === 'child') {
      query.childSafe = true;
    }

    const works = await this.workModel
      .find(query)
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    const mapped = works.map((work) => this.mapWork(work));

    // Enrich with aggregated reaction counts from chapters
    const workIds = mapped.map((w) => w.id);
    const reactionSummaries =
      await this.reactionsService.getWorkReactionSummaries(workIds);

    return mapped.map((work) => {
      const summary = reactionSummaries.get(work.id) || {
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
      };
      return { ...work, ...summary };
    });
  }

  async search(query: string, role?: string) {
    const searchRegex = new RegExp(query, 'i');

    const works = await this.workModel.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'authorId',
          foreignField: '_id',
          as: 'author',
        },
      },
      { $unwind: '$author' },
      {
        $match: {
          status: 'published',
          ...(role === 'child' ? { childSafe: true } : {}),
          $or: [
            { title: searchRegex },
            { 'author.username': searchRegex },
            { tags: { $in: [searchRegex] } },
          ],
        },
      },
      { $sort: { averageRating: -1, updatedAt: -1 } },
      { $limit: 20 },
    ]);

    return works.map((work) => ({
      ...this.mapWork(work),
      authorUsername: work.author.username,
    }));
  }

  async getById(id: string, requesterId?: string, role?: string) {
    const workId = this.toObjectId(id);

    // Populate author username in a single query
    const work = await this.workModel
      .findById(workId)
      .populate<{
        authorId: { _id: Types.ObjectId; username: string };
      }>('authorId', 'username')
      .lean()
      .exec();
    if (!work) throw new NotFoundException('Work not found');

    // Normalise authorId after populate
    const authorObj = work.authorId as any;
    const authorUsername: string = authorObj?.username ?? '';
    const authorIdStr: string =
      authorObj?._id?.toString() ?? authorObj?.toString() ?? '';

    // Security: Prevent children from fetching unsafe data manually
    if (role === 'child' && !work.childSafe) {
      throw new ForbiddenException(
        'This work is not accessible in Children Mode',
      );
    }

    // Non-published works are only visible to their owner or collaborators
    if (work.status !== 'published') {
      if (!requesterId) {
        throw new ForbiddenException('Authentication required');
      }
      
      const isOwner = authorIdStr === requesterId;
      const isCollab = await this.collaborationService.isCollaborator(id, requesterId);

      if (!isOwner && !isCollab) {
        throw new ForbiddenException('You do not have access to this work');
      }
    }

    // Use public listing (no ownership check) for published works;
    // fall back to owner-only listing for drafts etc.
    const chapters =
      work.status === 'published'
        ? await this.chaptersService.listPublicByWork(id, requesterId)
        : await this.chaptersService.listByWork(id, requesterId!);

    const reactionSummaries =
      await this.reactionsService.getSummariesForChapters({
        chapterIds: chapters.map((c: any) => c.id || c._id).filter(Boolean),
        requesterId,
      });

    const chaptersWithReactions = chapters.map((chapter: any) => {
      const key = (chapter.id || chapter._id || '').toString();
      const summary = reactionSummaries.get(key) || {
        likesCount: 0,
        commentsCount: 0,
        viewerHasLiked: false,
      };
      return { ...chapter, ...summary };
    });

    return {
      ...this.mapWork({ ...work, authorId: authorIdStr }),
      authorUsername,
      chapters: chaptersWithReactions,
    };
  }

  async update(id: string, requesterId: string, updateWorkDto: UpdateWorkDto) {
    const workId = this.toObjectId(id);
    await this.assertWorkOwner(workId, requesterId);

    const updatePayload: any = {};

    if (typeof updateWorkDto.title === 'string') {
      const title = updateWorkDto.title.trim();
      if (!title) throw new BadRequestException('title cannot be empty');
      updatePayload.title = title;
    }
    if (typeof updateWorkDto.summary === 'string') {
      updatePayload.summary = updateWorkDto.summary.trim();
    }
    if (typeof updateWorkDto.coverImage === 'string') {
      updatePayload.coverImage = updateWorkDto.coverImage;
    }
    if (Array.isArray(updateWorkDto.tags)) {
      updatePayload.tags = this.normalizeTags(updateWorkDto.tags);
    }
    if (
      updateWorkDto.status === 'draft' ||
      updateWorkDto.status === 'pending_moderation'
    ) {
      updatePayload.status = updateWorkDto.status;
    }

    if (
      typeof updatePayload.title === 'string' ||
      typeof updatePayload.summary === 'string'
    ) {
      const current = await this.workModel.findById(workId).lean().exec();
      if (!current) throw new NotFoundException('Work not found');

      const nextTitle =
        typeof updatePayload.title === 'string'
          ? updatePayload.title
          : current.title;
      const nextSummary =
        typeof updatePayload.summary === 'string'
          ? updatePayload.summary
          : current.summary || '';

      const moderationFields = await this.evaluateAndBuildModerationFields(
        [nextTitle, nextSummary].join('\n\n'),
      );
      Object.assign(updatePayload, moderationFields);
    }

    const updated = await this.workModel
      .findByIdAndUpdate(
        workId,
        { $set: updatePayload },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Work not found');

    return this.mapWork(updated);
  }

  async publish(id: string, requesterId: string) {
    const workId = this.toObjectId(id);
    await this.assertWorkOwner(workId, requesterId);

    const existing = await this.workModel.findById(workId).lean().exec();
    if (!existing) throw new NotFoundException('Work not found');

    // Works are metadata, so we allow publishing even if they are in 'needs_admin_review'
    // Chapters will be strictly moderated.
    if (existing.status === 'rejected') {
      throw new BadRequestException(
        'This work has been rejected by moderation and cannot be published.',
      );
    }

    const updated = await this.workModel
      .findByIdAndUpdate(
        workId,
        { $set: { status: 'published' } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Work not found');

    // Notify followers
    try {
      const authorProfile = await this.profileModel.findById(updated.authorId);
      if (authorProfile && authorProfile.followers && authorProfile.followers.length > 0) {
        const notificationPromises = authorProfile.followers.map((followerId) =>
          this.notificationsService.createNotification({
            userId: followerId,
            type: NotificationType.ANNOUNCEMENT,
            title: `New Book: ${updated.title}`,
            description: `${authorProfile.username} just published a new book: ${updated.summary.substring(0, 100)}${updated.summary.length > 100 ? '...' : ''}`,
            metadata: {
              authorName: authorProfile.username,
              authorImage: authorProfile.profilePicture,
              bookTitle: updated.title,
              bookImage: updated.coverImage,
              referenceId: updated._id.toString(),
            },
          } as any),
        );
        await Promise.all(notificationPromises);
      }
    } catch (err) {
      console.error('Failed to notify followers about book publication:', err);
    }

    return this.mapWork(updated);
  }

  async listReviewQueue(status?: string) {
    const query: any = {};

    if (status === 'needs_admin_review') {
      query.status = 'needs_admin_review';
    } else if (status === 'rejected') {
      query.status = 'rejected';
    } else {
      query.status = { $in: ['needs_admin_review', 'rejected'] };
    }

    const queue = await this.workModel
      .find(query)
      .sort({ moderationUpdatedAt: -1, updatedAt: -1 })
      .lean()
      .exec();

    const authorMap = await this.getAuthorUsernameMap(
      queue.map((work) => work.authorId),
    );

    return queue.map((work) => ({
      ...this.mapWork(work),
      authorUsername: authorMap.get(work.authorId.toString()) || undefined,
    }));
  }

  async getAdminDetails(id: string) {
    const workId = this.toObjectId(id);
    const work = await this.workModel.findById(workId).lean().exec();
    if (!work) throw new NotFoundException('Work not found');

    const [authorMap, chapters] = await Promise.all([
      this.getAuthorUsernameMap([work.authorId]),
      this.chaptersService.listPublicByWork(id),
    ]);

    return {
      ...this.mapWork(work),
      authorUsername: authorMap.get(work.authorId.toString()) || undefined,
      chapters,
    };
  }

  async adminApprove(id: string, adminId: string) {
    const workId = this.toObjectId(id);
    const reviewerId = this.toObjectId(adminId, 'adminId');

    const updated = await this.workModel
      .findByIdAndUpdate(
        workId,
        {
          $set: {
            status: 'approved',
            moderationReason: 'approved_by_admin',
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            moderationUpdatedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Work not found');
    return this.mapWork(updated);
  }
  async adminReject(id: string, adminId: string) {
    const workId = this.toObjectId(id);
    const reviewerId = this.toObjectId(adminId, 'adminId');

    const updated = await this.workModel
      .findByIdAndUpdate(
        workId,
        {
          $set: {
            status: 'rejected',
            moderationReason: 'rejected_by_admin',
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            moderationUpdatedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Work not found');
    return this.mapWork(updated);
  }

  async adminFlag(id: string, adminId: string) {
    const workId = this.toObjectId(id);
    const reviewerId = this.toObjectId(adminId, 'adminId');

    const updated = await this.workModel
      .findByIdAndUpdate(
        workId,
        {
          $set: {
            status: 'needs_admin_review',
            moderationReason: 'flagged_by_admin',
            reviewedBy: reviewerId,
            reviewedAt: new Date(),
            moderationUpdatedAt: new Date(),
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Work not found');
    return this.mapWork(updated);
  }

  async delete(id: string, requesterId: string) {
    const workId = this.toObjectId(id);
    await this.assertWorkOwner(workId, requesterId);

    // 1. Delete all chapters associated with this work
    await this.chaptersService.deleteByWork(id, requesterId);

    // 2. Delete the work itself
    const deleted = await this.workModel
      .findByIdAndDelete(workId)
      .lean()
      .exec();
    if (!deleted) throw new NotFoundException('Work not found');

    return {
      success: true,
      message: 'Work and its chapters deleted successfully',
    };
  }
}
