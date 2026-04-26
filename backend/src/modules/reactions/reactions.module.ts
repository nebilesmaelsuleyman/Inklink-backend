import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CHAPTER_MODEL_NAME,
  ChapterSchema,
} from '../chapters/schema/chapter.schema';
import { USER_MODEL_NAME, UserSchema } from '../users/user.schema';
import { WORK_MODEL_NAME, WorkSchema } from '../works/schema/work.schema';
import { REACTION_MODEL_NAME, ReactionSchema } from './schema/reaction.schema';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: REACTION_MODEL_NAME, schema: ReactionSchema },
      { name: CHAPTER_MODEL_NAME, schema: ChapterSchema },
      { name: WORK_MODEL_NAME, schema: WorkSchema },
      { name: USER_MODEL_NAME, schema: UserSchema },
    ]),
  ],
  controllers: [ReactionsController],
  providers: [ReactionsService],
  exports: [ReactionsService],
})
export class ReactionsModule {}
