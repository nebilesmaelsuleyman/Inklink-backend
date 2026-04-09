import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WORK_MODEL_NAME, WorkDocument } from '../works/schema/work.schema';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';
import { CHAPTER_MODEL_NAME, ChapterDocument } from './schema/chapter.schema';
import { ModerationService } from '../moderation/moderation.service';

@Injectable()
export class ChaptersService {
  constructor(
    @InjectModel(CHAPTER_MODEL_NAME)
    private readonly chapterModel: Model<ChapterDocument>,
    @InjectModel(WORK_MODEL_NAME)
    private readonly workModel: Model<WorkDocument>,
    private readonly moderationService: ModerationService,

  ) {}

  private toObjectId(id: string, field = 'id') {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return new Types.ObjectId(id);
  }

  private mapChapter(chapter: any) {
    return {
     id: chapter._id.toString(),
     workId: chapter.workId.toString(),
     title: chapter.title,
     orderIndex: chapter.orderIndex,
     contentText: chapter.contentText,
     moderationStatus: chapter.moderationStatus,
     moderationConfidence: chapter.moderationConfidence,
     moderationReason: chapter.moderationReason,
     childSafe: chapter.childSafe,
     adultSafe: chapter.adultSafe,
     moderationUpdatedAt: chapter.moderationUpdatedAt,
     createdAt: chapter.createdAt,
     updatedAt: chapter.updatedAt,

    };
  }


private async evaluateAndBuildModerationFields(text: string) {
   const result = await this.moderationService.moderateText(text);
   return {
     moderationStatus:
       result.decision === 'approved'
         ? 'approved'
         : result.decision === 'rejected'
           ? 'rejected'
           : 'needs_admin_review',
     moderationConfidence: result.confidence,
     moderationReason: result.reason,
     childSafe: result.childSafe,
     adultSafe: result.adultSafe,
     moderationUpdatedAt: new Date(),
   };
 }


  private async ensureWorkExists(workId: Types.ObjectId) {
    const exists = await this.workModel.exists({ _id: workId });
    if (!exists) throw new NotFoundException('Work not found');
  }

  private async assertWorkOwner(workId: Types.ObjectId, requesterId: string) {
    const ownerId = this.toObjectId(requesterId, 'requesterId');
    const owned = await this.workModel.exists({ _id: workId, authorId: ownerId });
    if (!owned) throw new ForbiddenException('You do not have access to this work');
  }

  private async assertChapterOwner(chapterId: Types.ObjectId, requesterId: string) {
    const chapter = await this.chapterModel.findById(chapterId).lean().exec();
    if (!chapter) throw new NotFoundException('Chapter not found');

    await this.assertWorkOwner(new Types.ObjectId(chapter.workId), requesterId);
    return chapter;
  }

  async listByWork(workId: string, requesterId: string) {
    const parsedWorkId = this.toObjectId(workId, 'workId');
    await this.assertWorkOwner(parsedWorkId, requesterId);

    const chapters = await this.chapterModel
      .find({ workId: parsedWorkId })
      .sort({ orderIndex: 1, createdAt: 1 })
      .lean()
      .exec();

    return chapters.map((chapter) => this.mapChapter(chapter));
  }

  async create(
    workId: string,
    requesterId: string,
    createChapterDto: CreateChapterDto,
  ) {
    const parsedWorkId = this.toObjectId(workId, 'workId');
    await this.ensureWorkExists(parsedWorkId);
    await this.assertWorkOwner(parsedWorkId, requesterId);

    const title = (createChapterDto.title || '').trim();
    if (!title) throw new BadRequestException('title is required');

    let orderIndex = createChapterDto.orderIndex;
    if (typeof orderIndex !== 'number') {
      const latest = await this.chapterModel
        .findOne({ workId: parsedWorkId })
        .sort({ orderIndex: -1 })
        .lean()
        .exec();
      orderIndex = latest ? latest.orderIndex + 1 : 0;
    }

    const created = await this.chapterModel.create({
      workId: parsedWorkId,
      title,
      orderIndex,
      contentText: createChapterDto.contentText || '',
    });

    return this.mapChapter(created.toObject());
  }

  async update(id: string, requesterId: string, updateChapterDto: UpdateChapterDto) {
    const chapterId = this.toObjectId(id);
    await this.assertChapterOwner(chapterId, requesterId);

    const updatePayload: any = {};

    if (typeof updateChapterDto.title === 'string') {
      const title = updateChapterDto.title.trim();
      if (!title) throw new BadRequestException('title cannot be empty');
      updatePayload.title = title;
    }

    if (typeof updateChapterDto.contentText === 'string') {
      updatePayload.contentText = updateChapterDto.contentText;
    }

    const updated = await this.chapterModel
      .findByIdAndUpdate(chapterId, { $set: updatePayload }, { new: true })
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Chapter not found');
    return this.mapChapter(updated);
  }

  async remove(id: string, requesterId: string) {
    const chapterId = this.toObjectId(id);
    await this.assertChapterOwner(chapterId, requesterId);

    const deleted = await this.chapterModel.findByIdAndDelete(chapterId).lean().exec();
    if (!deleted) throw new NotFoundException('Chapter not found');
    return { ok: true };
  }

  async reorder(workId: string, requesterId: string, reorderDto: ReorderChaptersDto) {
    const parsedWorkId = this.toObjectId(workId, 'workId');
    await this.ensureWorkExists(parsedWorkId);
    await this.assertWorkOwner(parsedWorkId, requesterId);

    const byChapterIds = Array.isArray(reorderDto.chapterIds)
      ? reorderDto.chapterIds
      : [];
    const byOrders = Array.isArray(reorderDto.orders) ? reorderDto.orders : [];

    let orders: Array<{ id: string; orderIndex: number }> = [];

    if (byChapterIds.length > 0) {
      orders = byChapterIds.map((id, index) => ({ id, orderIndex: index }));
    } else if (byOrders.length > 0) {
      orders = byOrders;
    } else {
      throw new BadRequestException('Provide chapterIds or orders');
    }

    const chapterObjectIds = orders.map(({ id }) => this.toObjectId(id, 'chapterId'));

    const existing = await this.chapterModel
      .find({ _id: { $in: chapterObjectIds }, workId: parsedWorkId })
      .lean()
      .exec();
    if (existing.length !== orders.length) {
      throw new BadRequestException('Some chapters do not belong to this work');
    }

    const tempBase = 1_000_000;

    await this.chapterModel.bulkWrite(
      orders.map((item, index) => ({
        updateOne: {
          filter: {
            _id: this.toObjectId(item.id, 'chapterId'),
            workId: parsedWorkId,
          },
          update: { $set: { orderIndex: tempBase + index } },
        },
      })),
    );

    await this.chapterModel.bulkWrite(
      orders.map((item) => ({
        updateOne: {
          filter: {
            _id: this.toObjectId(item.id, 'chapterId'),
            workId: parsedWorkId,
          },
          update: { $set: { orderIndex: item.orderIndex } },
        },
      })),
    );

    return this.listByWork(workId, requesterId);
  }
}
