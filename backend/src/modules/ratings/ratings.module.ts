import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';
import { RATING_MODEL_NAME, RatingSchema } from './schema/rating.schema';
import { WorksModule } from '../works/works.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RATING_MODEL_NAME, schema: RatingSchema },
    ]),
    WorksModule,
  ],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
