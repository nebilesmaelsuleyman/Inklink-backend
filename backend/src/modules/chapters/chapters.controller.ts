import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChaptersService } from './chapters.service';
import { CreateChapterDto } from './dto/create-chapter.dto';
import { ReorderChaptersDto } from './dto/reorder-chapters.dto';
import { UpdateChapterDto } from './dto/update-chapter.dto';

type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    username: string;
  };
};

@ApiTags('editor-chapters')
@ApiCookieAuth('auth_token')
@Controller()
@UseGuards(JwtAuthGuard)
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Post('works/:workId/chapters')
  @ApiOperation({ summary: 'Create chapter in work' })
  @ApiParam({ name: 'workId', description: 'Work id' })
  @ApiBody({ type: CreateChapterDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Param('workId') workId: string,
    @Body() createChapterDto: CreateChapterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chaptersService.create(workId, request.user.sub, createChapterDto);
  }

  @Get('works/:workId/chapters')
  @ApiOperation({ summary: 'List work chapters' })
  @ApiParam({ name: 'workId', description: 'Work id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  listByWork(@Param('workId') workId: string, @Req() request: AuthenticatedRequest) {
    return this.chaptersService.listByWork(workId, request.user.sub);
  }

  @Patch('chapters/:id')
  @ApiOperation({ summary: 'Update chapter title/content' })
  @ApiParam({ name: 'id', description: 'Chapter id' })
  @ApiBody({ type: UpdateChapterDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param('id') id: string,
    @Body() updateChapterDto: UpdateChapterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chaptersService.update(id, request.user.sub, updateChapterDto);
  }

  @Delete('chapters/:id')
  @ApiOperation({ summary: 'Delete chapter' })
  @ApiParam({ name: 'id', description: 'Chapter id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.chaptersService.remove(id, request.user.sub);
  }

  @Post('works/:workId/chapters/reorder')
  @ApiOperation({ summary: 'Reorder chapters in work' })
  @ApiParam({ name: 'workId', description: 'Work id' })
  @ApiBody({ type: ReorderChaptersDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  reorder(
    @Param('workId') workId: string,
    @Body() reorderDto: ReorderChaptersDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chaptersService.reorder(workId, request.user.sub, reorderDto);
  }
}
