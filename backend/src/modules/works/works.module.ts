import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChaptersModule } from '../chapters/chapters.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ReactionsModule } from '../reactions/reactions.module';
import { WORK_MODEL_NAME, WorkSchema } from './schema/work.schema';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfileSchema } from '../profile/profile.model';
import { TtsModule } from '../tts/tts.module';
import {
  CHAPTER_MODEL_NAME,
  ChapterSchema,
} from '../chapters/schema/chapter.schema';
import { YjsModule } from '../yjs/yjs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WORK_MODEL_NAME, schema: WorkSchema },
      { name: 'Profile', schema: ProfileSchema },
      { name: CHAPTER_MODEL_NAME, schema: ChapterSchema },
    ]),
    ChaptersModule,
    ReactionsModule,
    ModerationModule,
    NotificationsModule,
    TtsModule,
    YjsModule,
    forwardRef(() => CollaborationModule),
  ],
  controllers: [WorksController],
  providers: [WorksService],
  exports: [WorksService, MongooseModule],
})
export class WorksModule {}
