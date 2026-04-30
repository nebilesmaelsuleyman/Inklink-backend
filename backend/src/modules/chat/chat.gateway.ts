import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WebSocket } from 'ws';
import { ChatService } from './chat.service';
import { Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';

@WebSocketGateway({ path: '/chat-ws' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly clients = new Map<string, WebSocket>(); // userId -> socket

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: WebSocket, req: any) {
    const userId = await this.extractUserId(req);
    if (!userId) {
      client.close(4401, 'Unauthorized');
      return;
    }
    this.clients.set(userId, client);
    console.log(`User connected to chat: ${userId}`);
  }

  handleDisconnect(client: WebSocket) {
    for (const [userId, socket] of this.clients.entries()) {
      if (socket === client) {
        this.clients.delete(userId);
        console.log(`User disconnected from chat: ${userId}`);
        break;
      }
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() data: { roomId: string; content: string },
  ) {
    const senderId = this.getUserIdBySocket(client);
    if (!senderId) return;

    const message = await this.chatService.sendMessage(
      new Types.ObjectId(data.roomId),
      senderId,
      data.content,
    );

    // Find recipients (members of the room)
    const memberships = await this.chatService.getRoomMembers(data.roomId);

    const recipientIds = memberships.map((m) => m.userId);

    // Broadcast to online recipients
    const payload = JSON.stringify({
      event: 'newMessage',
      data: {
        ...message,
        roomId: data.roomId,
      },
    });

    for (const recipientId of recipientIds) {
      const socket = this.clients.get(recipientId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      } else if (recipientId !== senderId) {
        // Only create persistent notification if the recipient is offline
        // and it's not the sender themselves
        await this.notificationsService.createMessageNotification(
          senderId,
          recipientId,
          data.content,
          data.roomId,
        );
      }
    }
  }

  private getUserIdBySocket(socket: WebSocket): string | null {
    for (const [userId, s] of this.clients.entries()) {
      if (s === socket) return userId;
    }
    return null;
  }

  private async extractUserId(req: any): Promise<string | null> {
    try {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token'); // Simplest for WS connection

      if (!token) {
        // Fallback to cookie if needed
        const cookieName =
          this.configService.get<string>('auth.cookieName') || 'auth_token';
        const cookieToken = this.getCookieValue(
          req?.headers?.cookie,
          cookieName,
        );
        if (!cookieToken) return null;
        return this.verifyToken(cookieToken);
      }

      return this.verifyToken(token);
    } catch {
      return null;
    }
  }

  private async verifyToken(token: string): Promise<string | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('auth.jwtSecret'),
      });
      return payload?.sub || payload?.id || null;
    } catch {
      return null;
    }
  }

  private getCookieValue(
    cookieHeader: string | undefined,
    key: string,
  ): string | null {
    if (!cookieHeader) return null;
    const chunks = cookieHeader.split(';');
    for (const chunk of chunks) {
      const [rawKey, ...rawValue] = chunk.trim().split('=');
      if (rawKey === key) return decodeURIComponent(rawValue.join('='));
    }
    return null;
  }
}
