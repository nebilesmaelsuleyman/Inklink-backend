import { Module } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';
import { CollaborationController } from './collaboration.controller';
import { CollaborationGateway } from './Gateway/collaboration.gateway';
import { RoomService } from './services/room.service';

@Module({
  controllers: [CollaborationController],
  providers: [CollaborationService, CollaborationGateway, RoomService],
})
export class CollaborationModule {}
