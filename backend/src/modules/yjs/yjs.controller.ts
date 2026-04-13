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
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { YjsPersistenceService } from './yjs-persistence.service';

type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    username: string;
  };
};

@ApiTags('editor-yjs')
@ApiCookieAuth('auth_token')
@Controller('yjs')
@UseGuards(JwtAuthGuard)
export class YjsController {
  constructor(private readonly yjsPersistenceService: YjsPersistenceService) {}

  @Post('docs/:docId/updates')
  @ApiOperation({ summary: 'Append Yjs binary update (base64)' })
  @ApiParam({ name: 'docId', description: 'Yjs document id or chapter id' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['update'],
      properties: {
        update: { type: 'string', description: 'base64-encoded Yjs update' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  appendUpdate(
    @Param('docId') docId: string,
    @Body('update') update: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.yjsPersistenceService.appendUpdate(
      docId,
      request.user.sub,
      update,
    );
  }

  @Get('docs/:docId/state')
  @ApiOperation({ summary: 'Get full Yjs state + state vector (base64)' })
  @ApiParam({ name: 'docId', description: 'Yjs document id or chapter id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getState(
    @Param('docId') docId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.yjsPersistenceService.getState(docId, request.user.sub);
  }

  @Get('docs/:docId/diff')
  @ApiOperation({ summary: 'Get Yjs diff from provided state vector' })
  @ApiParam({ name: 'docId', description: 'Yjs document id or chapter id' })
  @ApiQuery({
    name: 'sv',
    required: true,
    description: 'base64-encoded state vector',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getDiff(
    @Param('docId') docId: string,
    @Query('sv') sv: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.yjsPersistenceService.getDiff(docId, request.user.sub, sv);
  }
}
