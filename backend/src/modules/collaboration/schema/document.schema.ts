import {Schema, Document} from 'mongoose';

export interface yDoc extends Document {
    roomName:string;
    state:Buffer;
    updatedAt:Date;

}
export const YDocumentSchema = new Schema<yDoc>({
    roomName:{type:String, required:true, unique:true},
    state:{type:Buffer, required:true},
    updatedAt:{type:Date, default:Date.now}
})
