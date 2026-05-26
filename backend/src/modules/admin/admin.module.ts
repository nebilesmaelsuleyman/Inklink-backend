import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PROFILE_MODEL_NAME, ProfileSchema } from '../profile/profile.model';
import { USER_MODEL_NAME, UserSchema } from '../users/user.schema';
import { WORK_MODEL_NAME, WorkSchema } from '../works/schema/work.schema';
import {
  CHAPTER_MODEL_NAME,
  ChapterSchema,
} from '../chapters/schema/chapter.schema';
import { TransactionSchema } from '../wallet/schema/transaction.schema';
import {
  PRICING_PLAN_MODEL_NAME,
  PricingPlanSchema,
} from '../subscription/schema/pricing-plan.schema';
import {
  SUBSCRIPTION_MODEL_NAME,
  SubscriptionSchema,
} from '../subscription/schema/subscription.schema';
import { WorkAggregationModule } from '../work-aggregation/work-aggregation.module';
import { YjsModule } from '../yjs/yjs.module';

@Module({
  imports: [
    WorkAggregationModule,
    YjsModule,
    MongooseModule.forFeature([
      { name: USER_MODEL_NAME, schema: UserSchema },
      { name: PROFILE_MODEL_NAME, schema: ProfileSchema },
      { name: WORK_MODEL_NAME, schema: WorkSchema },
      { name: CHAPTER_MODEL_NAME, schema: ChapterSchema },
      { name: 'Transaction', schema: TransactionSchema },
      { name: PRICING_PLAN_MODEL_NAME, schema: PricingPlanSchema },
      { name: SUBSCRIPTION_MODEL_NAME, schema: SubscriptionSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
