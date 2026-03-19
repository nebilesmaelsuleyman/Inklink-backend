import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as Y from 'yjs';
// Import the correct interface from document.schema
import { YDocument } from '../schema/document.schema';

@Injectable()
export class PersistenceService {
    constructor(@InjectModel('YDocument') private model: Model<YDocument>) {}


    async laodDocument(roomName: string): Promise<Y.Doc> {
        const doc = await this.model.findOne({ roomName }).exec();
        if (doc && doc.state) {
            const ydoc = new Y.Doc();
            const uint8State = new Uint8Array(doc.state);
            Y.applyUpdate(ydoc, uint8State);
            return ydoc;
        }
        return new Y.Doc();
    }


    async saveDocument(roomName: string, ydoc: Y.Doc): Promise<void> {

        const state= Y.encodeStateAsUpdate(ydoc);
        await this.model.findOneAndUpdate({roomName},{roomName,state:Buffer.from(state),updatedAt:new Date()},{upsert:true})
    }


}