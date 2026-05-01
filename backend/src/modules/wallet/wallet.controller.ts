import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.getWallet(userId);
  }

  @Get('transactions')
  async getTransactions(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.walletService.getTransactions(userId);
  }
}
