import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { POST_MODEL_NAME, PostSchema } from './schema/post.schema';
import { PROFILE_MODEL_NAME } from '../profile/profile.model';
import { ProfileSchema } from '../profile/profile.model';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: POST_MODEL_NAME, schema: PostSchema },
      { name: PROFILE_MODEL_NAME, schema: ProfileSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
