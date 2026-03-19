import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect
} from '@nestjs/websockets';
import { RoomService } from '../services/room.service';
import { WebSocket } from 'ws';
import * as Y from 'yjs';

@WebSocketGateway()
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(private readonly roomService: RoomService) {}

  async handleConnection(client:WebSocket, req:any) {
    const roomName= this.extractRoom(req)
    const room= await this.roomService.getOrCreate(roomName)
    room.connections.add(client);

    //initial sync 
    const state = Y.encodeStateAsUpdate(room.doc);
    client.send(state);

    client.on('message',(data:Uint8Array)=>{
       this.handleMessage(roomName, client, data);
    })
  }
 handleDisconnect(client: WebSocket) {
    // You should track room per client (missing here → you fix it)
  }

  private async handleMessage(
    roomName: string,
    client: WebSocket,
    data: Uint8Array
  ) {
    const room = await this.roomService.getOrCreate(roomName);

    // Apply incoming update
    Y.applyUpdate(room.doc, data);
  }

  private extractRoom(req: any): string {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('room') || 'default';
  }
}