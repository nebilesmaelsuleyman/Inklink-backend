import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { YjsPersistenceService } from './yjs-persistence.service';

type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    username: string;
  };
};

@Controller('yjs')
@UseGuards(JwtAuthGuard)
export class YjsController {
  constructor(private readonly yjsPersistenceService: YjsPersistenceService) {}

  @Post('docs/:docId/updates')
  appendUpdate(
    @Param('docId') docId: string,
    @Body('update') update: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.yjsPersistenceService.appendUpdate(docId, request.user.sub, update);
  }

  @Get('docs/:docId/state')
  getState(@Param('docId') docId: string, @Req() request: AuthenticatedRequest) {
    return this.yjsPersistenceService.getState(docId, request.user.sub);
  }

  @Get('docs/:docId/diff')
  getDiff(
    @Param('docId') docId: string,
    @Query('sv') sv: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.yjsPersistenceService.getDiff(docId, request.user.sub, sv);
  }
}
