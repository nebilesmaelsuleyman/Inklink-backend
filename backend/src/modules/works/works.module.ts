import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChaptersModule } from '../chapters/chapters.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ReactionsModule } from '../reactions/reactions.module';
import { WORK_MODEL_NAME, WorkSchema } from './schema/work.schema';
import { WorksController } from './works.controller';
import { WorksService } from './works.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WORK_MODEL_NAME, schema: WorkSchema }]),
    ChaptersModule,
    ReactionsModule,
    ModerationModule,
  ],
  controllers: [WorksController],
  providers: [WorksService],
  exports: [WorksService, MongooseModule],
})
export class WorksModule {}
