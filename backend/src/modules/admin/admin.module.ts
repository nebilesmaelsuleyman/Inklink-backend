import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import {
  PROFILE_MODEL_NAME,
  ProfileSchema,
} from '../profile/profile.model';
import { USER_MODEL_NAME, UserSchema } from '../users/user.schema';
import { WORK_MODEL_NAME, WorkSchema } from '../works/schema/work.schema';
import {
  CHAPTER_MODEL_NAME,
  ChapterSchema,
} from '../chapters/schema/chapter.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: USER_MODEL_NAME, schema: UserSchema },
      { name: PROFILE_MODEL_NAME, schema: ProfileSchema },
      { name: WORK_MODEL_NAME, schema: WorkSchema },
      { name: CHAPTER_MODEL_NAME, schema: ChapterSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
