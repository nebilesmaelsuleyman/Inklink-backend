import { WebSocket } from 'ws';
import * as Y from 'yjs';
import * as awareness from 'y-protocols/dist/awareness.cjs';

export interface IRoom {
    doc: Y.Doc;
    awareness: awareness.Awareness;
    connections: Set<WebSocket>;
    name: string;
    createdAt: Date;
}