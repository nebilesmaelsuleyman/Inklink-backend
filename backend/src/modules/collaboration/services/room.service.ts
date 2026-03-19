import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { IRoom } from '../interface/room.interface';

@Injectable()
export class RoomService {
  private rooms = new Map<string, IRoom>();

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
      this.rooms.set(roomName, room);
    }
    return room;
  }

  broadcast(room: IRoom, message: Uint8Array) {
    room.connections.forEach((conn) => {
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
