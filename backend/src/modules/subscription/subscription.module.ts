import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import {
  SUBSCRIPTION_MODEL_NAME,
  SubscriptionSchema,
} from './schema/subscription.schema';
import {
  CHAPTER_PURCHASE_MODEL_NAME,
  ChapterPurchaseSchema,
} from './schema/chapter-purchase.schema';
import {
  CHAPTER_READ_MODEL_NAME,
  ChapterReadSchema,
} from './schema/chapter-read.schema';
import {
  CHAPTER_MODEL_NAME,
  ChapterSchema,
} from '../chapters/schema/chapter.schema';
import { WORK_MODEL_NAME, WorkSchema } from '../works/schema/work.schema';
import { USER_MODEL_NAME, UserSchema } from '../users/user.schema';
import { WalletModule } from '../wallet/wallet.module';
import { ChapaService } from './chapa.service';

@Module({
  imports: [
    WalletModule,
    MongooseModule.forFeature([
      { name: SUBSCRIPTION_MODEL_NAME, schema: SubscriptionSchema },
      { name: CHAPTER_PURCHASE_MODEL_NAME, schema: ChapterPurchaseSchema },
      { name: CHAPTER_READ_MODEL_NAME, schema: ChapterReadSchema },
      { name: CHAPTER_MODEL_NAME, schema: ChapterSchema },
      { name: WORK_MODEL_NAME, schema: WorkSchema },
      { name: USER_MODEL_NAME, schema: UserSchema },
    ]),
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, ChapaService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
