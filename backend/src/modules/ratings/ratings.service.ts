import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RATING_MODEL_NAME, RatingDocument } from './schema/rating.schema';
import { WORK_MODEL_NAME, WorkDocument } from '../works/schema/work.schema';

@Injectable()
export class RatingsService {
  constructor(
    @InjectModel(RATING_MODEL_NAME)
    private readonly ratingModel: Model<RatingDocument>,
    @InjectModel(WORK_MODEL_NAME)
    private readonly workModel: Model<WorkDocument>,
  ) {}

  async rateWork(workId: string, userId: string, value: number) {
    const workObjectId = new Types.ObjectId(workId);
    const userObjectId = new Types.ObjectId(userId);

    const work = await this.workModel.findById(workObjectId);
    if (!work) throw new NotFoundException('Work not found');

    // Update or create rating
    await this.ratingModel.findOneAndUpdate(
      { workId: workObjectId, userId: userObjectId },
      { value },
      { upsert: true, returnDocument: 'after' },
    );

    // Recompute average rating for the work
    await this.recomputeWorkRating(workObjectId);

    return this.getWorkRating(workId, userId);
  }

  async getWorkRating(workId: string, userId?: string) {
    const workObjectId = new Types.ObjectId(workId);
    
    const work = await this.workModel.findById(workObjectId).select('averageRating ratingsCount');
    if (!work) throw new NotFoundException('Work not found');

    let userRating: number | null = null;
    if (userId) {
      const rating = await this.ratingModel.findOne({
        workId: workObjectId,
        userId: new Types.ObjectId(userId),
      });
      userRating = rating ? rating.value : null;
    }

    return {
      averageRating: work.averageRating || 0,
      ratingsCount: work.ratingsCount || 0,
      userRating,
    };
  }

  private async recomputeWorkRating(workId: Types.ObjectId) {
    const stats = await this.ratingModel.aggregate([
      { $match: { workId } },
      {
        $group: {
          _id: '$workId',
          averageRating: { $avg: '$value' },
          ratingsCount: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      await this.workModel.findByIdAndUpdate(workId, {
        averageRating: Math.round(stats[0].averageRating * 10) / 10,
        ratingsCount: stats[0].ratingsCount,
      });
    } else {
      await this.workModel.findByIdAndUpdate(workId, {
        averageRating: 0,
        ratingsCount: 0,
      });
    }
  }
}
