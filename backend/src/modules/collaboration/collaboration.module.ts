import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { YjsModule } from '../yjs/yjs.module';
import { CollaborationService } from './collaboration.service';
import { CollaborationController } from './collaboration.controller';
import { CollaborationGateway } from './Gateway/collaboration.gateway';
import { RoomService } from './services/room.service';
import { MongooseModule } from '@nestjs/mongoose';
import { CollaborationSchema } from './schema/collaboration.schema';
import { UsersModule } from '../users/users.module';
import { WorksModule } from '../works/works.module';
import { ChaptersModule } from '../chapters/chapters.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    YjsModule,
    UsersModule,
    WorksModule,
    forwardRef(() => ChaptersModule),
    NotificationsModule,
    MongooseModule.forFeature([
      { name: 'Collaboration', schema: CollaborationSchema },
    ]),
  ],
  controllers: [CollaborationController],
  providers: [CollaborationService, CollaborationGateway, RoomService],
  exports: [CollaborationService],
})
export class CollaborationModule {}
