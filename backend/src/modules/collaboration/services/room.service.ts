import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { IRoom } from '../interface/room.interface';
import * as awarenessProtocol from 'y-protocols/awareness';
import { MessageProtocol, MessageType } from '../protocol/message.protocol';

@Injectable()
export class RoomService {
  private rooms = new Map<string, IRoom>();

  getRoom(roomName: string): IRoom | undefined {
    return this.rooms.get(roomName);
  }

  async getOrCreate(roomName: string): Promise<IRoom> {
    let room = this.rooms.get(roomName);
    if (!room) {
      const doc = new Y.Doc();
      room = {
        name: roomName,
        doc,
        awareness: new Awareness(doc),
        connections: new Set(),
        createdAt: new Date(),
      };
      doc.on('update', (update: Uint8Array, origin: unknown) => {
        const message = MessageProtocol.encode(MessageType.Sync, update);
        const except = room!.connections.has(origin as WebSocket) ? (origin as WebSocket) : undefined;
        this.broadcast(room!, message, except);
      });

      room.awareness.on('update', ({ added, updated, removed }, origin) => {
        const changed = added.concat(updated, removed);
        if (changed.length === 0) return;

        const message = MessageProtocol.encode(
          MessageType.Awareness,
          awarenessProtocol.encodeAwarenessUpdate(room!.awareness, changed),
        );
        const except = room!.connections.has(origin as WebSocket) ? (origin as WebSocket) : undefined;
        this.broadcast(room!, message, except);
      });
      this.rooms.set(roomName, room);
    }
    return room;
  }

  broadcast(room: IRoom, message: Uint8Array, except?: WebSocket) {
    room.connections.forEach((conn) => {
      if (except && conn === except) return;
      if (conn.readyState === WebSocket.OPEN) {
        try {
          conn.send(message);
        } catch {
          conn.close();
          room.connections.delete(conn);
        }
      }
    });
  }

  removeConnections(roomName: string, connection: WebSocket) {
    const room = this.rooms.get(roomName);
    if (!room) return;

    room.connections.delete(connection);
    if (room.connections.size === 0) {
      this.rooms.delete(roomName);
    }
  }
}
