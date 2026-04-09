import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChaptersService } from '../chapters/chapters.service';
import { ModerationService } from '../moderation/moderation.service';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { WORK_MODEL_NAME, WorkDocument } from './schema/work.schema';

@Injectable()
export class WorksService {
  constructor(
    @InjectModel(WORK_MODEL_NAME)
    private readonly workModel: Model<WorkDocument>,
    private readonly chaptersService: ChaptersService,
    private readonly moderationService: ModerationService,
  ) {}

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
     createdAt: work.createdAt,
     updatedAt: work.updatedAt,

    };
  }

   private async evaluateAndBuildModerationFields(text: string) {
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
 }


  private async assertWorkOwner(workId: Types.ObjectId, requesterId: string) {
    const ownerId = this.toObjectId(requesterId, 'requesterId');
    const owned = await this.workModel.exists({ _id: workId, authorId: ownerId });
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

    return works.map((work) => this.mapWork(work));
  }

  async getById(id: string, requesterId: string) {
    const workId = this.toObjectId(id);
    await this.assertWorkOwner(workId, requesterId);

    const work = await this.workModel.findById(workId).lean().exec();
    if (!work) throw new NotFoundException('Work not found');

    const chapters = await this.chaptersService.listByWork(id, requesterId);
    return {
      ...this.mapWork(work),
      chapters,
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
    if (updateWorkDto.status === 'draft' || updateWorkDto.status === 'published') {
      updatePayload.status = updateWorkDto.status;
    }

    const updated = await this.workModel
      .findByIdAndUpdate(workId, { $set: updatePayload }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Work not found');

    return this.mapWork(updated);
  }

  async publish(id: string, requesterId: string) {
    const workId = this.toObjectId(id);
    await this.assertWorkOwner(workId, requesterId);
    const updated = await this.workModel
      .findByIdAndUpdate(
        workId,
        { $set: { status: 'published' } },
        { new: true },
      )
      .lean()
      .exec();

    if (!updated) throw new NotFoundException('Work not found');
    return this.mapWork(updated);
  }
}
