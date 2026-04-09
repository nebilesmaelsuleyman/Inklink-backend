import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as Y from 'yjs';
import { CHAPTER_MODEL_NAME, ChapterDocument } from '../chapters/schema/chapter.schema';
import { WORK_MODEL_NAME, WorkDocument } from '../works/schema/work.schema';
import {
  YJS_DOCUMENT_MODEL_NAME,
  YjsDocumentEntity,
} from './schema/yjs-document.schema';
import {
  YJS_SNAPSHOT_MODEL_NAME,
  YjsSnapshotEntity,
} from './schema/yjs-snapshot.schema';
import { YJS_UPDATE_MODEL_NAME, YjsUpdateEntity } from './schema/yjs-update.schema';

@Injectable()
export class YjsPersistenceService {
  constructor(
    @InjectModel(YJS_DOCUMENT_MODEL_NAME)
    private readonly yjsDocumentModel: Model<YjsDocumentEntity>,
    @InjectModel(YJS_UPDATE_MODEL_NAME)
    private readonly yjsUpdateModel: Model<YjsUpdateEntity>,
    @InjectModel(YJS_SNAPSHOT_MODEL_NAME)
    private readonly yjsSnapshotModel: Model<YjsSnapshotEntity>,
    @InjectModel(CHAPTER_MODEL_NAME)
    private readonly chapterModel: Model<ChapterDocument>,
    @InjectModel(WORK_MODEL_NAME)
    private readonly workModel: Model<WorkDocument>,
  ) {}

  private toObjectId(id: string, field = 'id') {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return new Types.ObjectId(id);
  }

  private encodeBase64(data: Uint8Array | Buffer) {
    return Buffer.from(data).toString('base64');
  }

  private decodeBase64(data: string, field = 'data') {
    if (!data || typeof data !== 'string') {
      throw new BadRequestException(`${field} is required`);
    }

    try {
      const buffer = Buffer.from(data, 'base64');
      return new Uint8Array(buffer);
    } catch {
      throw new BadRequestException(`${field} must be valid base64`);
    }
  }

  private async resolveDocument(docId: string, requesterId: string) {
    const parsedId = this.toObjectId(docId, 'docId');

    const byDocumentId = await this.yjsDocumentModel.findById(parsedId).lean().exec();
    if (byDocumentId) return byDocumentId;

    const byChapterId = await this.yjsDocumentModel
      .findOne({ chapterId: parsedId })
      .lean()
      .exec();
    if (byChapterId) return byChapterId;

    const chapter = await this.chapterModel.findById(parsedId).lean().exec();
    if (!chapter) throw new NotFoundException('Yjs document not found for docId/chapterId');

    const work = await this.workModel.findById(chapter.workId).lean().exec();
    if (!work) throw new NotFoundException('Work not found for chapter');

    const requesterObjectId = this.toObjectId(requesterId, 'requesterId');
    if (String(work.authorId) !== requesterObjectId.toString()) {
      throw new ForbiddenException('You do not have access to this document');
    }

    const created = await this.yjsDocumentModel.create({
      chapterId: chapter._id,
      workId: chapter.workId,
      ownerId: work.authorId,
    });

    return created.toObject();
  }

  private async assertDocumentOwner(documentId: Types.ObjectId, requesterId: string) {
    const ownerId = this.toObjectId(requesterId, 'requesterId');
    const owned = await this.yjsDocumentModel.exists({ _id: documentId, ownerId });
    if (!owned) {
      throw new ForbiddenException('You do not have access to this document');
    }
  }

  private async computeState(documentId: Types.ObjectId) {
    const snapshot = await this.yjsSnapshotModel
      .findOne({ documentId })
      .lean()
      .exec();

    const doc = new Y.Doc();
    let lastSeq = 0;

    if (snapshot?.state) {
      Y.applyUpdate(doc, new Uint8Array(snapshot.state));
      lastSeq = snapshot.lastSeq || 0;
    }

    const updates = await this.yjsUpdateModel
      .find({ documentId, seq: { $gt: lastSeq } })
      .sort({ seq: 1 })
      .lean()
      .exec();

    for (const entry of updates) {
      Y.applyUpdate(doc, new Uint8Array(entry.update));
      lastSeq = entry.seq;
    }

    return { doc, lastSeq };
  }

async appendUpdate(docId: string, requesterId: string, base64Update: string) {
   const yjsDoc = await this.resolveDocument(docId, requesterId);
   const documentId = new Types.ObjectId(yjsDoc._id);
   await this.assertDocumentOwner(documentId, requesterId);
   const updateBytes = this.decodeBase64(base64Update, 'update');


   await this.workModel
     .updateOne(
       {
         _id: yjsDoc.workId,
         status: { $in: ['published', 'approved'] },
       } as any,
       {
         $set: {
           status: 'needs_admin_review',
           moderationReason: 'yjs_update_requires_review',
           moderationUpdatedAt: new Date(),
         },
         $unset: {
           reviewedBy: '',
           reviewedAt: '',
         },
       },
     )
     .exec();


   for (let attempt = 0; attempt < 3; attempt += 1) {
     const latest = await this.yjsUpdateModel
       .findOne({ documentId })
       .sort({ seq: -1 })
       .lean()
       .exec();
     const nextSeq = latest ? latest.seq + 1 : 1;


     try {
       const created = await this.yjsUpdateModel.create({
         documentId,
         seq: nextSeq,
         update: Buffer.from(updateBytes),
       });


       return {
         ok: true,
         documentId: documentId.toString(),
         seq: created.seq,
         createdAt: created.createdAt,
       };
     } catch (error: any) {
       if (error?.code !== 11000 || attempt === 2) {
         throw error;
       }
     }
   }


   throw new BadRequestException('Could not append update');
 }


  async getState(docId: string, requesterId: string) {
    const yjsDoc = await this.resolveDocument(docId, requesterId);
    const documentId = new Types.ObjectId(yjsDoc._id);
    await this.assertDocumentOwner(documentId, requesterId);
    const { doc, lastSeq } = await this.computeState(documentId);

    return {
      documentId: documentId.toString(),
      state: this.encodeBase64(Y.encodeStateAsUpdate(doc)),
      stateVector: this.encodeBase64(Y.encodeStateVector(doc)),
      lastSeq,
    };
  }

  async getDiff(docId: string, requesterId: string, stateVectorBase64: string) {
    const yjsDoc = await this.resolveDocument(docId, requesterId);
    const documentId = new Types.ObjectId(yjsDoc._id);
    await this.assertDocumentOwner(documentId, requesterId);
    const { doc, lastSeq } = await this.computeState(documentId);
    const stateVector = this.decodeBase64(stateVectorBase64, 'sv');
    const diff = Y.encodeStateAsUpdate(doc, stateVector);

    return {
      documentId: documentId.toString(),
      diff: this.encodeBase64(diff),
      lastSeq,
    };
  }

  async compactSnapshot(docId: string, requesterId: string) {
    const yjsDoc = await this.resolveDocument(docId, requesterId);
    const documentId = new Types.ObjectId(yjsDoc._id);
    await this.assertDocumentOwner(documentId, requesterId);
    const { doc, lastSeq } = await this.computeState(documentId);

    const state = Buffer.from(Y.encodeStateAsUpdate(doc));
    const stateVector = Buffer.from(Y.encodeStateVector(doc));

    await this.yjsSnapshotModel
      .updateOne(
        { documentId },
        {
          $set: {
            state,
            stateVector,
            lastSeq,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      )
      .exec();

    return {
      ok: true,
      documentId: documentId.toString(),
      lastSeq,
    };
  }
}
