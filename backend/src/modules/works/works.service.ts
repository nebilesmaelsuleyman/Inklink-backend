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
import { WORK_MODEL_NAME, WorkDocument, WorkStatus } from './schema/work.schema';
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
      authors.map((author: any) => [
        author._id.toString(),
        author.username || '',
      ]),
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

  private isModerationServiceUnavailable(reason?: string) {
    return Boolean(reason && reason.includes('moderation_service_unavailable'));
  }

  private async applyWorkModerationResult(
    workId: Types.ObjectId,
    title: string,
    summary: string,
    moderationFields: {
      status: WorkStatus;
      moderationConfidence: number;
      moderationReason: string;
      childSafe: boolean;
      adultSafe: boolean;
      moderationUpdatedAt: Date;
      reviewedBy?: undefined;
      reviewedAt?: undefined;
    },
  ) {
    const updated = await this.workModel
      .findOneAndUpdate(
        {
          _id: workId,
          title,
          summary,
        },
        {
          $set: {
            moderationConfidence: moderationFields.moderationConfidence,
            moderationReason: moderationFields.moderationReason,
            childSafe: moderationFields.childSafe,
            adultSafe: moderationFields.adultSafe,
            moderationUpdatedAt: moderationFields.moderationUpdatedAt,
            reviewedBy: undefined,
            reviewedAt: undefined,
            status: moderationFields.status,
          },
        },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    return updated ?? null;
  }

  private queueWorkModeration(
    workId: Types.ObjectId,
    title: string,
    summary: string,
    attempt = 0,
  ) {
    const delayMs = Math.min(1000 * 2 ** attempt, 30000);
    setTimeout(() => {
      void (async () => {
        try {
          const moderationFields = await this.evaluateAndBuildModerationFields(
            [title, summary].join('\n\n'),
          );

          if (
            this.isModerationServiceUnavailable(moderationFields.moderationReason) &&
            attempt < 5
          ) {
            this.queueWorkModeration(workId, title, summary, attempt + 1);
            return;
          }

          const updated = await this.applyWorkModerationResult(
            workId,
            title,
            summary,
             moderationFields as any,
          );

          if (!updated && attempt < 5) {
            this.queueWorkModeration(workId, title, summary, attempt + 1);
            return;
          }

          if (!updated) {
            console.warn(
              '[WorksService] Skipped stale background moderation update',
              workId.toString(),
            );
          }
        } catch (err) {
          console.error('[WorksService] Background moderation failed:', err);
        }
      })();
    }, 100);
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

  private async assertWorkEditor(workId: Types.ObjectId, requesterId: string) {
    const work = await this.workModel.findById(workId).lean().exec();
    if (!work) throw new NotFoundException('Work not found');

    if (work.authorId.toString() === requesterId) {
      return;
    }

    const canEdit = await this.collaborationService.canEditWork(
      workId.toString(),
      requesterId,
    );

    if (!canEdit) {
      throw new ForbiddenException('You do not have edit access to this work');
    }
  }

  async create(requesterId: string, createWorkDto: CreateWorkDto) {
    const authorId = this.toObjectId(requesterId, 'requesterId');
    const title = (createWorkDto.title || '').trim();
    if (!title) throw new BadRequestException('title is required');

    const summary = (createWorkDto.summary || '').trim();
     const initialStatus: WorkStatus = 'draft';

    const created = await this.workModel.create({
      authorId,
      title,
      summary,
      coverImage: createWorkDto.coverImage,
      tags: this.normalizeTags(createWorkDto.tags),
      status: initialStatus,
      moderationConfidence: 0,
      moderationReason: 'moderation_queued',
      moderationUpdatedAt: new Date(),
      childSafe: undefined,
      adultSafe: undefined,
      reviewedBy: undefined,
      reviewedAt: undefined,
    });

    const moderationFields = await this.evaluateAndBuildModerationFields(
      [title, summary].join('\n\n'),
    );

    const updated = await this.applyWorkModerationResult(
      created._id,
      title,
      summary,
      moderationFields,
    );

    if (this.isModerationServiceUnavailable(moderationFields.moderationReason)) {
      this.queueWorkModeration(created._id, title, summary);
    }

    return this.mapWork(updated ?? created.toObject());
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
    const matchQuery: any = { status: 'published' };
    if (tag) {
      matchQuery.tags = tag;
    }

    if (role === 'child') {
      matchQuery.childSafe = true;
    }

    const works = await this.workModel.aggregate([
      {
        $match: matchQuery,
      },
      {
        $lookup: {
          from: 'chapters',
          let: { workId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$workId', '$$workId'] },
                    { $eq: ['$moderationStatus', 'approved'] },
                    {
                      $regexMatch: {
                        input: { $ifNull: ['$contentText', ''] },
                        regex: /\S/,
                      },
                    },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'visibleChapters',
        },
      },
      {
        $match: {
          'visibleChapters.0': { $exists: true },
        },
      },
      {
        $project: {
          visibleChapters: 0,
        },
      },
      { $sort: { updatedAt: -1 } },
    ]);

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
          from: 'chapters',
          let: { workId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$workId', '$$workId'] },
                    { $eq: ['$moderationStatus', 'approved'] },
                    {
                      $regexMatch: {
                        input: { $ifNull: ['$contentText', ''] },
                        regex: /\S/,
                      },
                    },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'visibleChapters',
        },
      },
      {
        $match: {
          'visibleChapters.0': { $exists: true },
        },
      },
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
      {
        $project: {
          visibleChapters: 0,
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
      const isCollab = await this.collaborationService.isCollaborator(
        id,
        requesterId,
      );

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

    if (work.status === 'published' && chaptersWithReactions.length === 0) {
      throw new NotFoundException('Work not found');
    }

    return {
      ...this.mapWork({ ...work, authorId: authorIdStr }),
      authorUsername,
      chapters: chaptersWithReactions,
    };
  }

  async update(id: string, requesterId: string, updateWorkDto: UpdateWorkDto) {
    const workId = this.toObjectId(id);
    await this.assertWorkEditor(workId, requesterId);

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

    const updated = await this.workModel
      .findByIdAndUpdate(
        workId,
        { $set: updatePayload },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Work not found');

    if (
      typeof updatePayload.title === 'string' ||
      typeof updatePayload.summary === 'string'
    ) {
      const nextTitle =
        typeof updatePayload.title === 'string'
          ? updatePayload.title
          : updated.title;
      const nextSummary =
        typeof updatePayload.summary === 'string'
          ? updatePayload.summary
          : updated.summary || '';

      const moderationFields = await this.evaluateAndBuildModerationFields(
        [nextTitle, nextSummary].join('\n\n'),
      );

      const moderated = await this.applyWorkModerationResult(
        workId,
        nextTitle,
        nextSummary,
         moderationFields as any,
      );

      if (this.isModerationServiceUnavailable(moderationFields.moderationReason)) {
        this.queueWorkModeration(workId, nextTitle, nextSummary);
      }

      return this.mapWork(moderated ?? updated);
    }

    return this.mapWork(updated);
  }

  async publish(id: string, requesterId: string) {
    const workId = this.toObjectId(id);
    await this.assertWorkOwner(workId, requesterId);

    const existing = await this.workModel.findById(workId).lean().exec();
    if (!existing) throw new NotFoundException('Work not found');

    // If the work was rejected, disallow publishing.
    if (existing.status === 'rejected') {
      throw new BadRequestException(
        'This work has been rejected by moderation and cannot be published.',
      );
    }

    if (
      existing.status === 'pending_moderation' ||
      existing.status === 'needs_admin_review'
    ) {
      throw new BadRequestException(
        'This work is still under moderation review. Please wait for the result before publishing.',
      );
    }

    if (existing.status === 'draft') {
      const moderationFields = await this.evaluateAndBuildModerationFields(
        [existing.title, existing.summary || ''].join('\n\n'),
      );

      if (moderationFields.status === 'rejected') {
        await this.workModel.findByIdAndUpdate(
          workId,
          {
            $set: {
              ...moderationFields,
              status: 'rejected',
            },
          },
          { returnDocument: 'after' },
        );

        throw new BadRequestException(
          'This work has been rejected by moderation and cannot be published.',
        );
      }

      if (moderationFields.status === 'needs_admin_review') {
        await this.workModel.findByIdAndUpdate(
          workId,
          {
            $set: {
              ...moderationFields,
              status: 'needs_admin_review',
            },
          },
          { returnDocument: 'after' },
        );

        throw new BadRequestException(
          'This work needs admin review before it can be published.',
        );
      }

      await this.workModel.findByIdAndUpdate(
        workId,
        {
          $set: {
            ...moderationFields,
            status: 'approved',
          },
        },
        { returnDocument: 'after' },
      );
    }

    const chapters = await this.chaptersService.listByWork(id, requesterId);
    if (chapters.length === 0) {
      throw new BadRequestException(
        'A work must have at least one chapter before it can be published.',
      );
    }

    const approvedChapters = chapters.filter(
      (c: any) => c.moderationStatus === 'approved',
    );
    const pendingChapters = chapters.filter(
      (c: any) => c.moderationStatus === 'needs_admin_review',
    );
    const rejectedChapters = chapters.filter(
      (c: any) => c.moderationStatus === 'rejected',
    );

    // If everything is rejected
    if (rejectedChapters.length === chapters.length) {
      throw new BadRequestException(
        'All chapters have been rejected by moderation. Please edit your content.',
      );
    }

    let nextStatus: string = 'published';

    // If the work itself needs admin review, or if there are no approved chapters but there are pending ones
    if (
       (existing.status as WorkStatus) === 'needs_admin_review' ||
      (approvedChapters.length === 0 && pendingChapters.length > 0)
    ) {
      nextStatus = 'needs_admin_review';
    }

    const updated = await this.workModel
      .findByIdAndUpdate(
        workId,
        { $set: { status: nextStatus } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Work not found');

    // Notify followers
    if (nextStatus === 'published' && existing.status !== 'published') {
      try {
        const authorProfile = await this.profileModel.findById(
          updated.authorId,
        );
        if (
          authorProfile &&
          authorProfile.followers &&
          authorProfile.followers.length > 0
        ) {
          const notificationPromises = authorProfile.followers.map(
            (followerId) =>
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
        console.error(
          'Failed to notify followers about book publication:',
          err,
        );
      }
    }

    return this.mapWork(updated);
  }

  async listReviewQueue(status?: string) {
    let workStatusQuery: any;
    let chapterStatusQuery: any;

    if (status === 'needs_admin_review') {
      workStatusQuery = 'needs_admin_review';
      chapterStatusQuery = 'needs_admin_review';
    } else if (status === 'rejected') {
      workStatusQuery = 'rejected';
      chapterStatusQuery = 'rejected';
    } else {
      workStatusQuery = { $in: ['needs_admin_review', 'rejected'] };
      chapterStatusQuery = { $in: ['needs_admin_review', 'rejected'] };
    }

    const flaggedWorkIds =
      await this.chaptersService.getFlaggedWorkIds(chapterStatusQuery);

    const query = {
      $or: [{ status: workStatusQuery }, { _id: { $in: flaggedWorkIds } }],
    };

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

  async adminApprove(
    id: string,
    adminId: string,
    options?: { childSafe?: boolean; adultSafe?: boolean },
  ) {
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
            childSafe: options?.childSafe ?? true,
            adultSafe: options?.adultSafe ?? true,
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
        { returnDocument: 'after' },
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
