import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { YjsModule } from '../yjs/yjs.module';
import { CollaborationService } from './collaboration.service';
import { CollaborationController } from './collaboration.controller';
import { CollaborationGateway } from './Gateway/collaboration.gateway';
import { RoomService } from './services/room.service';

@Module({
  imports: [ConfigModule, AuthModule, YjsModule],
  controllers: [CollaborationController],
  providers: [CollaborationService, CollaborationGateway, RoomService],
})
export class CollaborationModule {}
