import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = AuthorPost & Document;

@Schema({ timestamps: true })
export class AuthorPost {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  likes: Types.ObjectId[];

  @Prop({ default: 0 })
  likesCount: number;
}

export const PostSchema = SchemaFactory.createForClass(AuthorPost);
export const POST_MODEL_NAME = 'AuthorPost';
