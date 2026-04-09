import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ModerationModule } from '../moderation/moderation.module';
import { WORK_MODEL_NAME, WorkSchema } from '../works/schema/work.schema';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';
import { CHAPTER_MODEL_NAME, ChapterSchema } from './schema/chapter.schema';

@Module({
  imports: [
    ModerationModule,
    MongooseModule.forFeature([
      { name: CHAPTER_MODEL_NAME, schema: ChapterSchema },
      { name: WORK_MODEL_NAME, schema: WorkSchema },
    ]),
  ],
  controllers: [ChaptersController],
  providers: [ChaptersService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
