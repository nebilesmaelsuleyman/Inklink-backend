import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatRoomSchema } from './schema/chat-room.schema';
import { ChatMembershipSchema } from './schema/membership.schema';
import { ChatMessageSchema } from './schema/message.schema';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PROFILE_MODEL_NAME, ProfileSchema } from '../profile/profile.model';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    NotificationsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MongooseModule.forFeature([
      { name: 'ChatRoom', schema: ChatRoomSchema },
      { name: 'ChatMembership', schema: ChatMembershipSchema },
      { name: 'ChatMessage', schema: ChatMessageSchema },
      { name: PROFILE_MODEL_NAME, schema: ProfileSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
