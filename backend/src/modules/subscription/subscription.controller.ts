import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

type AuthenticatedRequest = {
  user: { sub: string; username: string; role: string };
};

@ApiTags('subscriptions')
@ApiCookieAuth('auth_token')
@Controller()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ─── Subscription Endpoints ──────────────────────────────────────────

  @Get('subscriptions/plans')
  @ApiOperation({ summary: 'Get available subscription plans' })
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscriptions/me')
  @ApiOperation({ summary: 'Get current user active subscription' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getMySubscription(@Req() request: AuthenticatedRequest) {
    return this.subscriptionService.getActiveSubscription(request.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions')
  @ApiOperation({ summary: 'Subscribe to a plan' })
  @ApiBody({ type: CreateSubscriptionDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  subscribe(
    @Body() dto: CreateSubscriptionDto,
    @Body('returnUrl') returnUrl: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionService.initSubscriptionPayment(
      request.user.sub, 
      dto.plan, 
      returnUrl || 'http://localhost:3000/dashboard'
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscriptions/cancel')
  @ApiOperation({ summary: 'Cancel active subscription' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  cancel(@Req() request: AuthenticatedRequest) {
    return this.subscriptionService.cancelSubscription(request.user.sub);
  }

  // ─── Chapter Access & Purchase ───────────────────────────────────────

  @UseGuards(OptionalJwtAuthGuard)
  @Get('chapters/:chapterId/access')
  @ApiOperation({ summary: 'Check if user can read a chapter (free/purchased/subscribed)' })
  @ApiParam({ name: 'chapterId', description: 'Chapter id' })
  checkAccess(
    @Param('chapterId') chapterId: string,
    @Req() request: any,
  ) {
    const userId = request.user?.sub;
    return this.subscriptionService.checkAccess(chapterId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('chapters/:chapterId/purchase')
  @ApiOperation({ summary: 'Purchase a single locked chapter' })
  @ApiParam({ name: 'chapterId', description: 'Chapter id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  purchaseChapter(
    @Param('chapterId') chapterId: string,
    @Body('returnUrl') returnUrl: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionService.initChapterPurchasePayment(
      chapterId, 
      request.user.sub,
      returnUrl || `http://localhost:3000/book/chapter/${chapterId}`
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('donations')
  @ApiOperation({ summary: 'Donate to an author' })
  @ApiBody({ schema: { properties: { authorId: { type: 'string' }, amount: { type: 'number' }, returnUrl: { type: 'string' } } } })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  donate(
    @Body('authorId') authorId: string,
    @Body('amount') amount: number,
    @Body('returnUrl') returnUrl: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.subscriptionService.initDonationPayment(
      authorId,
      request.user.sub,
      amount,
      returnUrl || 'http://localhost:3000/home'
    );
  }

  // ─── Chapa Callback ─────────────────────────────────────────────────

  @Get('payments/callback')
  @ApiOperation({ summary: 'Chapa webhook/callback to verify payment' })
  async paymentCallback(
    @Req() request: any,
  ) {
    // Chapa might send the tx_ref in the query or body depending on webhook vs redirect
    const txRef = request.query.trx_ref || request.body?.trx_ref;
    if (!txRef) {
      return { message: 'No transaction reference provided' };
    }
    return this.subscriptionService.handleChapaCallback(txRef as string);
  }

  // ─── Read Progress ──────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('chapters/:chapterId/read-progress')
  @ApiOperation({ summary: 'Log chapter read progress (0-100)' })
  @ApiParam({ name: 'chapterId', description: 'Chapter id' })
  @ApiBody({ schema: { properties: { readPercentage: { type: 'number' } } } })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  logReadProgress(
    @Param('chapterId') chapterId: string,
    @Body('readPercentage') readPercentage: number,
    @Req() request: AuthenticatedRequest,
  ) {
    const pct = Math.max(0, Math.min(100, Number(readPercentage) || 0));
    return this.subscriptionService.logReadProgress(
      chapterId,
      request.user.sub,
      pct,
    );
  }

  // ─── User Purchases ─────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('purchases/me')
  @ApiOperation({ summary: 'Get chapters the current user has purchased' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getMyPurchases(@Req() request: AuthenticatedRequest) {
    return this.subscriptionService.getUserPurchases(request.user.sub);
  }
}
