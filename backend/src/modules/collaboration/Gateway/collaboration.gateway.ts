import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { RoomService } from '../services/room.service';
import { RawData, WebSocket } from 'ws';
import * as Y from 'yjs';
import { MessageProtocol, MessageType } from '../protocol/message.protocol';
import * as awarenessProtocol from 'y-protocols/awareness';

@WebSocketGateway({ path: '/collab' })
export class CollaborationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly clientRooms = new WeakMap<WebSocket, string>();

  constructor(private readonly roomService: RoomService) {}

  async handleConnection(client: WebSocket, req: any) {
    const roomName = this.extractRoom(req);
    const room = await this.roomService.getOrCreate(roomName);
    room.connections.add(client);
    this.clientRooms.set(client, roomName);

    // initial sync
    const state = Y.encodeStateAsUpdate(room.doc);
    client.send(MessageProtocol.encode(MessageType.Sync, state));

    // initial awareness (if any)
    const awarenessClientIds = Array.from(room.awareness.getStates().keys()) as number[];
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
      this.clientRooms.delete(client);
    }
  }

  private async handleBinaryMessage(
    roomName: string,
    client: WebSocket,
    data: Uint8Array,
  ) {
    const room = await this.roomService.getOrCreate(roomName);

    try {
      const { type, payload } = MessageProtocol.decode(data);
      switch (type) {
        case MessageType.Sync:
          Y.applyUpdate(room.doc, payload, client);
          break;
        case MessageType.Awareness:
          awarenessProtocol.applyAwarenessUpdate(room.awareness, payload, client);
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

  private asUint8Array(data: RawData): Uint8Array {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (Array.isArray(data)) return new Uint8Array(Buffer.concat(data));
    if (typeof data === 'string') return new TextEncoder().encode(data);
    return new Uint8Array(data);
  }
}
