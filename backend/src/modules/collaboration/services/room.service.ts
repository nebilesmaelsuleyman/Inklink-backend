import { Injectable } from '@nestjs/common';
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import { IRoom } from '../interface/room.interface';
import { PersistenceService } from './persistence.service';

enum MessageType {
    sync =0,
    Awareness=1
}
@Injectable()
export class RoomService {
    private rooms = new Map<string, IRoom>();

    constructor(private persistence:PersistenceService){}
    
    
    async getOrCreate(roomName:string):Promise<IRoom>{
        let room = this.rooms.get(roomName);
        if (!room) {
            const doc = new Y.Doc();
      const awareness = new Awareness(doc);
      await this.persistence.laodDocument(roomName);
            room = {
                name: roomName,
                doc,
                awareness: new Awareness(doc),
                connections: new Set(),
                createdAt: new Date()
            };
            this.rooms.set(roomName, room);
        }
        return room;
    }

    private encodeMessage(type:MessageType,payload:Uint8Array){
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder,type);
        encoding.writeVarUint8Array(encoder,payload);
        return encoding.toUint8Array(encoder);

    }
    
    broadcast(room:IRoom, message:Uint8Array){
        room.connections.forEach((conn)=>{
            if(conn.readyState === WebSocket.OPEN){
                try{
                    conn.send(message);
                }catch{
                    conn.close();
                    room.connections.delete(conn);
                }
            }
        })
    }

}