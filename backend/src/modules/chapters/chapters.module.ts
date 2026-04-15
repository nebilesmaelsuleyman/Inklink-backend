import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LibraryModule } from '../library/library.module';
import { ModerationModule } from '../moderation/moderation.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { USER_MODEL_NAME, UserSchema } from '../users/user.schema';
import { WORK_MODEL_NAME, WorkSchema } from '../works/schema/work.schema';
import { ChaptersController } from './chapters.controller';
import { ChaptersService } from './chapters.service';
import { CHAPTER_MODEL_NAME, ChapterSchema } from './schema/chapter.schema';

@Module({
  imports: [
    ModerationModule,
    LibraryModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: CHAPTER_MODEL_NAME, schema: ChapterSchema },
      { name: WORK_MODEL_NAME, schema: WorkSchema },
      { name: USER_MODEL_NAME, schema: UserSchema },
    ]),
  ],
  controllers: [ChaptersController],
  providers: [ChaptersService],
  exports: [ChaptersService],
})
export class ChaptersModule {}
