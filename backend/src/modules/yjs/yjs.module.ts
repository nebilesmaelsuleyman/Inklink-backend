import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CHAPTER_MODEL_NAME,
  ChapterSchema,
} from '../chapters/schema/chapter.schema';
import { WorkAggregationModule } from '../work-aggregation/work-aggregation.module';
import { WORK_MODEL_NAME, WorkSchema } from '../works/schema/work.schema';
import {
  YJS_DOCUMENT_MODEL_NAME,
  YjsDocumentSchema,
} from './schema/yjs-document.schema';
import {
  YJS_SNAPSHOT_MODEL_NAME,
  YjsSnapshotSchema,
} from './schema/yjs-snapshot.schema';
import {
  YJS_UPDATE_MODEL_NAME,
  YjsUpdateSchema,
} from './schema/yjs-update.schema';
import { YjsController } from './yjs.controller';
import { YjsPersistenceService } from './yjs-persistence.service';

@Module({
  imports: [
    WorkAggregationModule,
    MongooseModule.forFeature([
      { name: YJS_DOCUMENT_MODEL_NAME, schema: YjsDocumentSchema },
      { name: YJS_UPDATE_MODEL_NAME, schema: YjsUpdateSchema },
      { name: YJS_SNAPSHOT_MODEL_NAME, schema: YjsSnapshotSchema },
      { name: CHAPTER_MODEL_NAME, schema: ChapterSchema },
      { name: WORK_MODEL_NAME, schema: WorkSchema },
    ]),
  ],
  controllers: [YjsController],
  providers: [YjsPersistenceService],
  exports: [YjsPersistenceService],
})
export class YjsModule {}
