import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RoomService } from '../services/room.service';
import { RawData, WebSocket } from 'ws';
import * as Y from 'yjs';
import { MessageProtocol, MessageType } from '../protocol/message.protocol';
import * as awarenessProtocol from 'y-protocols/awareness';
import { YjsPersistenceService } from '../../yjs/yjs-persistence.service';

@WebSocketGateway({ path: '/collab' })
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly clientRooms = new WeakMap<WebSocket, string>();
  private readonly clientUsers = new WeakMap<WebSocket, string>();
  private readonly hydratedRooms = new Set<string>();

  constructor(
    private readonly roomService: RoomService,
    private readonly yjsPersistenceService: YjsPersistenceService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: WebSocket, req: any) {
    const userId = await this.extractUserId(req);
    if (!userId) {
      client.close(4401, 'Unauthorized');
      return;
    }

    const roomName = this.extractRoom(req);
    const room = await this.roomService.getOrCreate(roomName);

    if (!this.hydratedRooms.has(roomName) && room.connections.size === 0) {
      const persisted = await this.yjsPersistenceService.getState(
        roomName,
        userId,
      );
      const persistedUpdate = Buffer.from(persisted.state, 'base64');
      if (persistedUpdate.length > 0) {
        Y.applyUpdate(room.doc, new Uint8Array(persistedUpdate), 'bootstrap');
      }
      this.hydratedRooms.add(roomName);
    }

    room.connections.add(client);
    this.clientRooms.set(client, roomName);
    this.clientUsers.set(client, userId);

    // initial sync
    const state = Y.encodeStateAsUpdate(room.doc);
    client.send(MessageProtocol.encode(MessageType.Sync, state));

    // initial awareness (if any)
    const awarenessClientIds = Array.from(
      room.awareness.getStates().keys(),
    ) as number[];
    if (awarenessClientIds.length > 0) {
      const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
        room.awareness,
        awarenessClientIds,
      );
      client.send(
        MessageProtocol.encode(MessageType.Awareness, awarenessUpdate),
      );
    }

    client.on('message', (data: RawData, isBinary: boolean) => {
      if (!isBinary) {
        const text = typeof data === 'string' ? data : data.toString();
        this.handlePlainTextMessage(roomName, client, text);
        return;
      }

      const message = this.asUint8Array(data);
      this.handleBinaryMessage(roomName, client, message);
    });
  }

  handleDisconnect(client: WebSocket) {
    const roomName = this.clientRooms.get(client);
    if (roomName) {
      this.roomService.removeConnections(roomName, client);

      const room = this.roomService.getRoom(roomName);
      if (!room || room.connections.size === 0) {
        this.hydratedRooms.delete(roomName);
      }

      this.clientRooms.delete(client);
    }
    this.clientUsers.delete(client);
  }

  private async handleBinaryMessage(
    roomName: string,
    client: WebSocket,
    data: Uint8Array,
  ) {
    const room = await this.roomService.getOrCreate(roomName);
    const userId = this.clientUsers.get(client);

    try {
      const { type, payload } = MessageProtocol.decode(data);
      switch (type) {
        case MessageType.Sync:
          Y.applyUpdate(room.doc, payload, client);
          if (userId) {
            await this.yjsPersistenceService.appendUpdate(
              roomName,
              userId,
              Buffer.from(payload).toString('base64'),
            );
          }
          break;
        case MessageType.Awareness:
          awarenessProtocol.applyAwarenessUpdate(
            room.awareness,
            payload,
            client,
          );
          break;
      }
    } catch {
      // ignore invalid messages
      return;
    }
  }

  private async handlePlainTextMessage(
    roomName: string,
    client: WebSocket,
    data: string,
  ) {
    const room = await this.roomService.getOrCreate(roomName);

    const trimmed = data.trim();
    if (!trimmed) return;

    // For debugging with tools like `wscat`, broadcast plain text to other clients.
    room.connections.forEach((conn) => {
      if (conn !== client && conn.readyState === WebSocket.OPEN) {
        conn.send(trimmed);
      }
    });
  }

  private extractRoom(req: any): string {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('room') || 'default';
  }

  private getCookieValue(
    cookieHeader: string | undefined,
    key: string,
  ): string | null {
    if (!cookieHeader) return null;
    const chunks = cookieHeader.split(';');
    for (const chunk of chunks) {
      const [rawKey, ...rawValue] = chunk.trim().split('=');
      if (rawKey === key) {
        return decodeURIComponent(rawValue.join('='));
      }
    }
    return null;
  }

  private async extractUserId(req: any): Promise<string | null> {
    try {
      const authHeader = req?.headers?.authorization as string | undefined;
      const bearerToken = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

      const cookieName =
        this.configService.get<string>('auth.cookieName') || 'auth_token';
      const cookieToken = this.getCookieValue(req?.headers?.cookie, cookieName);
      const token = bearerToken || cookieToken;
      if (!token) return null;

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        username: string;
      }>(token, {
        secret:
          this.configService.get<string>('auth.jwtSecret') ||
          'change-me-in-env',
      });

      return payload?.sub || null;
    } catch {
      return null;
    }
  }

  private asUint8Array(data: RawData): Uint8Array {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
    if (typeof data === 'string') return new TextEncoder().encode(data);
    return new Uint8Array(data);
  }
}
