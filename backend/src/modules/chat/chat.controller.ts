import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('inbox')
  @UseGuards(JwtAuthGuard)
  getUserConversations(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.chatService.getUserConversations(userId);
  }

  @Get(':roomId/messages')
  @UseGuards(JwtAuthGuard)
  getMessages(@Param('roomId') roomId: string, @Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.chatService.getMessages(new Types.ObjectId(roomId), userId);
  }

  @Post('direct')
  @UseGuards(JwtAuthGuard)
  getOrCreateDirectRoom(
    @Req() req: any,
    @Body('targetUserId') targetUserId: string,
  ) {
    const currentUserId = req.user.sub || req.user.id;
    console.log(
      `[ChatController] getOrCreateDirectRoom: current=${currentUserId}, target=${targetUserId}`,
    );
    return this.chatService.getOrCreateDirectRoom(currentUserId, targetUserId);
  }

  @Post(':roomId/members')
  @UseGuards(JwtAuthGuard)
  addMember(
    @Param('roomId') roomId: string,
    @Req() req: any,
    @Body('memberUserId') memberUserId: string,
  ) {
    const actorUserId = req.user.sub || req.user.id;
    return this.chatService.addMember(
      new Types.ObjectId(roomId),
      actorUserId,
      memberUserId,
    );
  }

  @Post(':roomId/messages')
  @UseGuards(JwtAuthGuard)
  sendMessage(
    @Param('roomId') roomId: string,
    @Req() req: any,
    @Body('content') content: string,
  ) {
    const senderUserId = req.user.sub || req.user.id;
    return this.chatService.sendMessage(
      new Types.ObjectId(roomId),
      senderUserId,
      content,
    );
  }
}
