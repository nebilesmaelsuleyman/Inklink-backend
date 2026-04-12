import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CHAPTER_MODEL_NAME, ChapterSchema } from '../chapters/schema/chapter.schema';
import { WORK_MODEL_NAME, WorkSchema } from '../works/schema/work.schema';
import { WorkAggregationService } from './work-aggregation.service';


@Module({
 imports: [
   MongooseModule.forFeature([
     { name: CHAPTER_MODEL_NAME, schema: ChapterSchema },
     { name: WORK_MODEL_NAME, schema: WorkSchema },
   ]),
 ],
 providers: [WorkAggregationService],
 exports: [WorkAggregationService],
})
export class WorkAggregationModule {}


