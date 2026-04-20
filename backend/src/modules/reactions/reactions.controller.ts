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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ReactionsService } from './reactions.service';

type OptionalAuthRequest = Request & {
  user?: {
    sub: string;
    username: string;
    role: 'user' | 'admin' | 'parent' | 'child';
  } | null;
};

@ApiTags('chapter-reactions')
@ApiCookieAuth('auth_token')
@Controller('chapters')
export class ReactionsController {
  constructor(private readonly reactionsService: ReactionsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':chapterId/reactions')
  @ApiOperation({ summary: 'Get chapter reactions summary (likes/comments)' })
  @ApiParam({ name: 'chapterId', description: 'Chapter id' })
  getSummary(
    @Param('chapterId') chapterId: string,
    @Req() request: OptionalAuthRequest,
  ) {
    const user = request.user || undefined;
    return this.reactionsService.getChapterSummary(
      chapterId,
      user?.sub,
      user?.role,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':chapterId/comments')
  @ApiOperation({ summary: 'List chapter comments (newest first)' })
  @ApiParam({ name: 'chapterId', description: 'Chapter id' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max 50' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor (reaction id)',
  })
  listComments(
    @Param('chapterId') chapterId: string,
    @Req() request: OptionalAuthRequest,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const user = request.user || undefined;
    return this.reactionsService.listComments(chapterId, user?.sub, user?.role, {
      limit,
      cursor,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post(':chapterId/like')
  @ApiOperation({ summary: 'Toggle like on a chapter' })
  @ApiParam({ name: 'chapterId', description: 'Chapter id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  toggleLike(
    @Param('chapterId') chapterId: string,
    @Req() request: any,
  ) {
    return this.reactionsService.toggleLike(
      chapterId,
      request.user.sub,
      request.user.role,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':chapterId/comments')
  @ApiOperation({ summary: 'Add a comment to a chapter' })
  @ApiParam({ name: 'chapterId', description: 'Chapter id' })
  @ApiBody({ type: CreateCommentDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  addComment(
    @Param('chapterId') chapterId: string,
    @Body() dto: CreateCommentDto,
    @Req() request: any,
  ) {
    return this.reactionsService.addComment(
      chapterId,
      request.user.sub,
      request.user.role,
      dto,
    );
  }
}

