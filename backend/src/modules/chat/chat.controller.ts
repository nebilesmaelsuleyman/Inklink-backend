import { Body, Controller, Param, Post } from '@nestjs/common';
import { Types } from 'mongoose';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post(':roomId/members')
  addMember(
    @Param('roomId') roomId: string,
    @Body('actorUserId') actorUserId: string,
    @Body('memberUserId') memberUserId: string,
  ) {
    return this.chatService.addMember(
      new Types.ObjectId(roomId),
      actorUserId,
      memberUserId,
    );
  }

  @Post(':roomId/messages')
  sendMessage(
    @Param('roomId') roomId: string,
    @Body('senderUserId') senderUserId: string,
    @Body('content') content: string,
  ) {
    return this.chatService.sendMessage(
      new Types.ObjectId(roomId),
      senderUserId,
      content,
    );
  }
}
