import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SUBSCRIPTION_MODEL_NAME,
  SubscriptionDocument,
  SubscriptionPlan,
} from './schema/subscription.schema';
import {
  CHAPTER_PURCHASE_MODEL_NAME,
  ChapterPurchaseDocument,
} from './schema/chapter-purchase.schema';
import {
  CHAPTER_READ_MODEL_NAME,
  ChapterReadDocument,
} from './schema/chapter-read.schema';
import {
  CHAPTER_MODEL_NAME,
  ChapterDocument,
} from '../chapters/schema/chapter.schema';
import { WORK_MODEL_NAME, WorkDocument } from '../works/schema/work.schema';
import { USER_MODEL_NAME, UserDocument } from '../users/user.schema';
import { WalletService } from '../wallet/wallet.service';
import { TransactionType } from '../wallet/schema/transaction.schema';
import { ChapaService } from './chapa.service';

/** Pricing config (ETB) */
const PLAN_PRICING: Record<SubscriptionPlan, { price: number; days: number }> =
  {
    weekly: { price: 50, days: 7 },
    monthly: { price: 150, days: 30 },
    yearly: { price: 1500, days: 365 },
  };

/** Revenue split */
const AUTHOR_SHARE_PERCENT = 80;
const PLATFORM_SHARE_PERCENT = 20;

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(SUBSCRIPTION_MODEL_NAME)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(CHAPTER_PURCHASE_MODEL_NAME)
    private readonly purchaseModel: Model<ChapterPurchaseDocument>,
    @InjectModel(CHAPTER_READ_MODEL_NAME)
    private readonly readModel: Model<ChapterReadDocument>,
    @InjectModel(CHAPTER_MODEL_NAME)
    private readonly chapterModel: Model<ChapterDocument>,
    @InjectModel(WORK_MODEL_NAME)
    private readonly workModel: Model<WorkDocument>,
    @InjectModel(USER_MODEL_NAME)
    private readonly userModel: Model<UserDocument>,
    private readonly walletService: WalletService,
    private readonly chapaService: ChapaService,
  ) {}

  private toObjectId(id: string, field = 'id') {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
    return new Types.ObjectId(id);
  }

  // ─── Subscription Management ─────────────────────────────────────────

  async getActiveSubscription(userId: string) {
    const now = new Date();
    await this.subscriptionModel.updateMany(
      { userId: this.toObjectId(userId), status: 'active', endDate: { $lt: now } },
      { $set: { status: 'expired' } },
    );

    const sub = await this.subscriptionModel
      .findOne({
        userId: this.toObjectId(userId),
        status: 'active',
        endDate: { $gte: now },
      })
      .lean()
      .exec();

    return sub
      ? {
          id: sub._id.toString(),
          plan: sub.plan,
          price: sub.price,
          status: sub.status,
          startDate: sub.startDate,
          endDate: sub.endDate,
        }
      : null;
  }

  /**
   * Initialize a Chapa payment for subscription.
   * Returns the Chapa checkout URL — frontend redirects the user there.
   */
  async initSubscriptionPayment(
    userId: string,
    plan: SubscriptionPlan,
    returnUrl: string,
  ) {
    const existing = await this.getActiveSubscription(userId);
    if (existing) {
      throw new BadRequestException(
        `You already have an active ${existing.plan} subscription until ${new Date(existing.endDate).toLocaleDateString()}`,
      );
    }

    const config = PLAN_PRICING[plan];
    if (!config) throw new BadRequestException('Invalid plan');

    const user = await this.userModel
      .findById(this.toObjectId(userId))
      .select('username email')
      .lean()
      .exec();

    const txRef = this.chapaService.generateTxRef('sub');
    const callbackUrl =
      (process.env.backendHost || 'http://localhost:4000') +
      '/payments/callback';

    const email = (user as any)?.email || `${((user as any)?.username || 'user').replace(/\s+/g, '')}@inklink.app`;
    
    console.log('[SubscriptionService] Initializing payment with payload:', {
      amount: config.price,
      email,
      txRef,
      callbackUrl,
    });

    const chapaRes = await this.chapaService.initializePayment({
      amount: config.price,
      currency: 'ETB',
      email,
      first_name: (user as any)?.username || 'InkLink',
      last_name: 'User',
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      customization: {
        title: 'InkLink Premium',
        description: `${plan.toUpperCase()} plan ${config.days} days access`,
      },
      meta: {
        type: 'subscription',
        userId,
        plan,
        price: config.price,
      },
    });

    // Store pending subscription with tx_ref for verification later
    await this.subscriptionModel.create({
      userId: this.toObjectId(userId),
      plan,
      price: config.price,
      status: 'pending' as any,
      startDate: new Date(),
      endDate: new Date(),
      txRef,
    });

    return {
      checkoutUrl: chapaRes.data.checkout_url,
      txRef,
    };
  }

  /**
   * Verify a Chapa subscription payment and activate the subscription.
   */
  async verifySubscriptionPayment(txRef: string) {
    const chapaRes = await this.chapaService.verifyPayment(txRef);

    if (chapaRes.data.status !== 'success') {
      throw new BadRequestException(
        `Payment not successful. Status: ${chapaRes.data.status}`,
      );
    }

    // Find the pending subscription
    const pending = await this.subscriptionModel
      .findOne({ txRef } as any)
      .exec();

    if (!pending) {
      throw new NotFoundException('Subscription transaction not found');
    }

    if (pending.status === 'active') {
      return {
        id: pending._id.toString(),
        plan: pending.plan,
        status: 'active',
        message: 'Subscription already active',
      };
    }

    const config = PLAN_PRICING[pending.plan as SubscriptionPlan];
    const now = new Date();
    const endDate = new Date(now.getTime() + config.days * 24 * 60 * 60 * 1000);

    pending.status = 'active';
    pending.startDate = now;
    pending.endDate = endDate;
    await pending.save();

    return {
      id: pending._id.toString(),
      plan: pending.plan,
      price: pending.price,
      status: 'active',
      startDate: now,
      endDate,
      message: 'Subscription activated successfully!',
    };
  }

  async cancelSubscription(userId: string) {
    const sub = await this.subscriptionModel.findOneAndUpdate(
      { userId: this.toObjectId(userId), status: 'active' },
      { $set: { status: 'cancelled' } },
      { returnDocument: 'after' },
    );
    if (!sub) throw new NotFoundException('No active subscription found');
    return {
      id: sub._id.toString(),
      plan: sub.plan,
      status: sub.status,
      endDate: sub.endDate,
    };
  }

  getPlans() {
    return Object.entries(PLAN_PRICING).map(([plan, config]) => ({
      plan,
      price: config.price,
      days: config.days,
      currency: 'ETB',
    }));
  }

  // ─── Chapter Access ──────────────────────────────────────────────────

  async checkAccess(
    chapterId: string,
    userId?: string,
  ): Promise<{
    hasAccess: boolean;
    accessType: 'free' | 'purchase' | 'subscription' | 'author' | 'none';
    price: number;
    isPremiumSubscriber: boolean;
  }> {
    const parsedChapterId = this.toObjectId(chapterId, 'chapterId');
    const chapter = await this.chapterModel
      .findById(parsedChapterId)
      .lean()
      .exec();
    if (!chapter) throw new NotFoundException('Chapter not found');

    const price = chapter.price || 0;

    if (price === 0) {
      return { hasAccess: true, accessType: 'free', price: 0, isPremiumSubscriber: false };
    }

    if (!userId) {
      return { hasAccess: false, accessType: 'none', price, isPremiumSubscriber: false };
    }

    const parsedUserId = this.toObjectId(userId, 'userId');

    const work = await this.workModel
      .findById(chapter.workId)
      .select('authorId')
      .lean()
      .exec();
    if (work && work.authorId.toString() === userId) {
      return { hasAccess: true, accessType: 'author', price, isPremiumSubscriber: false };
    }

    const purchased = await this.purchaseModel.exists({
      userId: parsedUserId,
      chapterId: parsedChapterId,
    });
    if (purchased) {
      return { hasAccess: true, accessType: 'purchase', price, isPremiumSubscriber: false };
    }

    const activeSub = await this.getActiveSubscription(userId);
    if (activeSub) {
      return { hasAccess: true, accessType: 'subscription', price, isPremiumSubscriber: true };
    }

    return { hasAccess: false, accessType: 'none', price, isPremiumSubscriber: false };
  }

  // ─── Chapter Purchase via Chapa ──────────────────────────────────────

  /**
   * Initialize a Chapa payment for a single chapter purchase.
   */
  async initChapterPurchasePayment(
    chapterId: string,
    userId: string,
    returnUrl: string,
  ) {
    const parsedChapterId = this.toObjectId(chapterId, 'chapterId');

    const chapter = await this.chapterModel
      .findById(parsedChapterId)
      .lean()
      .exec();
    if (!chapter) throw new NotFoundException('Chapter not found');

    const price = chapter.price || 0;
    if (price === 0) {
      throw new BadRequestException('This chapter is free — no purchase needed');
    }

    const existing = await this.purchaseModel.exists({
      userId: this.toObjectId(userId),
      chapterId: parsedChapterId,
    });
    if (existing) {
      throw new BadRequestException('You have already purchased this chapter');
    }

    const work = await this.workModel
      .findById(chapter.workId)
      .select('authorId title')
      .lean()
      .exec();
    if (!work) throw new NotFoundException('Work not found');

    const user = await this.userModel
      .findById(this.toObjectId(userId))
      .select('username email')
      .lean()
      .exec();

    const txRef = this.chapaService.generateTxRef('chp');
    const callbackUrl =
      (process.env.backendHost || 'http://localhost:4000') +
      '/payments/callback';

    const email = (user as any)?.email || `${((user as any)?.username || 'user').replace(/\s+/g, '')}@inklink.app`;

    const chapaRes = await this.chapaService.initializePayment({
      amount: price,
      currency: 'ETB',
      email,
      first_name: (user as any)?.username || 'InkLink',
      last_name: 'Reader',
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      customization: {
        title: 'Buy Chapter',
        description: `Chapter ${chapter.title.replace(/[^a-zA-Z0-9.\-_ ]/g, '').substring(0, 30)}`,
      },
      meta: {
        type: 'chapter_purchase',
        userId,
        chapterId,
        workId: chapter.workId.toString(),
        authorId: work.authorId.toString(),
        price,
        chapterTitle: chapter.title,
        workTitle: work.title,
      },
    });

    return {
      checkoutUrl: chapaRes.data.checkout_url,
      txRef,
    };
  }

  // ─── Donations via Chapa ─────────────────────────────────────────────

  /**
   * Initialize a Chapa payment for a donation to an author.
   */
  async initDonationPayment(
    authorId: string,
    userId: string,
    amount: number,
    returnUrl: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Donation amount must be greater than zero');
    }

    const author = await this.userModel
      .findById(this.toObjectId(authorId))
      .select('username email')
      .lean()
      .exec();
    if (!author) throw new NotFoundException('Author not found');

    const user = await this.userModel
      .findById(this.toObjectId(userId))
      .select('username email')
      .lean()
      .exec();

    const txRef = this.chapaService.generateTxRef('don');
    const callbackUrl =
      (process.env.backendHost || 'http://localhost:4000') +
      '/payments/callback';

    const email = (user as any)?.email || `${((user as any)?.username || 'user').replace(/\s+/g, '')}@inklink.app`;

    const chapaRes = await this.chapaService.initializePayment({
      amount: amount,
      currency: 'ETB',
      email,
      first_name: (user as any)?.username || 'InkLink',
      last_name: 'Donor',
      tx_ref: txRef,
      callback_url: callbackUrl,
      return_url: returnUrl,
      customization: {
        title: 'Donation',
        description: `Support ${author.username.replace(/[^a-zA-Z0-9.\-_ ]/g, '').substring(0, 30)}`,
      },
      meta: {
        type: 'donation',
        userId,
        authorId,
        amount,
        authorUsername: author.username,
      },
    });

    return {
      checkoutUrl: chapaRes.data.checkout_url,
      txRef,
    };
  }

  /**
   * Verify a Chapa donation payment and record it.
   */
  async verifyDonationPayment(txRef: string) {
    const chapaRes = await this.chapaService.verifyPayment(txRef);

    if (chapaRes.data.status !== 'success') {
      throw new BadRequestException(
        `Payment not successful. Status: ${chapaRes.data.status}`,
      );
    }

    const meta = chapaRes.data.meta || {};
    const { userId, authorId, amount } = meta as any;

    if (!authorId || !amount) {
      throw new BadRequestException('Invalid transaction metadata');
    }

    const donationAmount = Number(amount) || chapaRes.data.amount;
    const authorShare = Math.round((donationAmount * AUTHOR_SHARE_PERCENT) / 100 * 100) / 100;
    const platformShare = Math.round((donationAmount * PLATFORM_SHARE_PERCENT) / 100 * 100) / 100;

    // Credit author wallet
    await this.walletService.addRevenue(
      authorId,
      authorShare,
      TransactionType.DONATION,
      `Donation from user ${userId || 'anonymous'}`,
    );

    return {
      message: 'Donation received successfully!',
      authorId,
      amount: donationAmount,
      authorShare,
      platformShare,
    };
  }


  /**
   * Verify a Chapa chapter purchase payment and record the purchase.
   */
  async verifyChapterPurchasePayment(txRef: string) {
    const chapaRes = await this.chapaService.verifyPayment(txRef);

    if (chapaRes.data.status !== 'success') {
      throw new BadRequestException(
        `Payment not successful. Status: ${chapaRes.data.status}`,
      );
    }

    const meta = chapaRes.data.meta || {};
    const { userId, chapterId, workId, authorId, price, chapterTitle, workTitle } =
      meta as any;

    if (!userId || !chapterId) {
      throw new BadRequestException('Invalid transaction metadata');
    }

    // Check if already recorded (idempotent)
    const existing = await this.purchaseModel.exists({
      userId: this.toObjectId(userId),
      chapterId: this.toObjectId(chapterId),
    });
    if (existing) {
      return { message: 'Purchase already recorded', chapterId };
    }

    const authorShare =
      Math.round(((price || chapaRes.data.amount) * AUTHOR_SHARE_PERCENT) / 100 * 100) / 100;
    const platformShare =
      Math.round(((price || chapaRes.data.amount) * PLATFORM_SHARE_PERCENT) / 100 * 100) / 100;

    await this.purchaseModel.create({
      userId: this.toObjectId(userId),
      chapterId: this.toObjectId(chapterId),
      workId: this.toObjectId(workId),
      authorId: this.toObjectId(authorId),
      price: price || chapaRes.data.amount,
      authorShare,
      platformShare,
    });

    // Credit author wallet
    await this.walletService.addRevenue(
      authorId,
      authorShare,
      TransactionType.PREMIUM,
      `Chapter purchase: "${chapterTitle || 'Chapter'}" from "${workTitle || 'Book'}"`,
    );

    return {
      message: 'Chapter purchased successfully',
      chapterId,
      price,
      authorShare,
    };
  }

  // ─── Chapa Callback Handler ──────────────────────────────────────────

  /**
   * Handle Chapa callback — verifies payment and activates subscription or records purchase.
   */
  async handleChapaCallback(txRef: string) {
    // Determine type from txRef prefix
    if (txRef.startsWith('sub-')) {
      return this.verifySubscriptionPayment(txRef);
    } else if (txRef.startsWith('chp-')) {
      return this.verifyChapterPurchasePayment(txRef);
    } else if (txRef.startsWith('don-')) {
      return this.verifyDonationPayment(txRef);
    } else {
      throw new BadRequestException('Unknown transaction type');
    }
  }

  // ─── Read Tracking ───────────────────────────────────────────────────

  async logReadProgress(chapterId: string, userId: string, readPercentage: number) {
    const parsedChapterId = this.toObjectId(chapterId, 'chapterId');
    const parsedUserId = this.toObjectId(userId, 'userId');

    const chapter = await this.chapterModel
      .findById(parsedChapterId)
      .select('workId price')
      .lean()
      .exec();
    if (!chapter) throw new NotFoundException('Chapter not found');

    const work = await this.workModel
      .findById(chapter.workId)
      .select('authorId')
      .lean()
      .exec();
    if (!work) throw new NotFoundException('Work not found');

    let accessType: 'subscription' | 'purchase' | 'free' = 'free';
    if ((chapter.price || 0) > 0) {
      const activeSub = await this.getActiveSubscription(userId);
      accessType = activeSub ? 'subscription' : 'purchase';
    }

    const qualified = readPercentage >= 50;

    await this.readModel.findOneAndUpdate(
      { userId: parsedUserId, chapterId: parsedChapterId },
      {
        $set: {
          workId: chapter.workId,
          authorId: work.authorId,
          readPercentage,
          accessType,
          qualified,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    return { chapterId, readPercentage, qualified };
  }

  // ─── User Purchases ────────────────────────────────────────────────

  async getUserPurchases(userId: string) {
    const purchases = await this.purchaseModel
      .find({ userId: this.toObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return purchases.map((p: any) => ({
      id: p._id.toString(),
      chapterId: p.chapterId.toString(),
      workId: p.workId.toString(),
      price: p.price,
      createdAt: p.createdAt,
    }));
  }
}
