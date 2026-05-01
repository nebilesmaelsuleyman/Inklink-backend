import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { WalletDocument } from './schema/wallet.schema';
import { TransactionDocument, TransactionType } from './schema/transaction.schema';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel('Wallet') private readonly walletModel: Model<WalletDocument>,
    @InjectModel('Transaction') private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  async getWallet(userId: string) {
    let wallet = await this.walletModel.findOne({ userId: new Types.ObjectId(userId) }).exec();
    if (!wallet) {
      wallet = await this.walletModel.create({
        userId: new Types.ObjectId(userId),
        balance: 0,
        adRevenue: 0,
        premiumRevenue: 0,
        donationRevenue: 0,
      });
    }
    return wallet;
  }

  async getTransactions(userId: string) {
    return this.transactionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(20)
      .exec();
  }

  async addRevenue(userId: string, amount: number, type: TransactionType, description: string) {
    const wallet = await this.getWallet(userId);
    
    const update: any = { $inc: { balance: amount } };
    if (type === TransactionType.AD) update.$inc.adRevenue = amount;
    if (type === TransactionType.PREMIUM) update.$inc.premiumRevenue = amount;
    if (type === TransactionType.DONATION) update.$inc.donationRevenue = amount;

    await this.walletModel.updateOne({ _id: wallet._id }, update).exec();
    
    return this.transactionModel.create({
      userId: new Types.ObjectId(userId),
      amount,
      type,
      description,
    });
  }
}
