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

@Controller()
@UseGuards(JwtAuthGuard)
export class ChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @Post('works/:workId/chapters')
  create(
    @Param('workId') workId: string,
    @Body() createChapterDto: CreateChapterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chaptersService.create(workId, request.user.sub, createChapterDto);
  }

  @Get('works/:workId/chapters')
  listByWork(@Param('workId') workId: string, @Req() request: AuthenticatedRequest) {
    return this.chaptersService.listByWork(workId, request.user.sub);
  }

  @Patch('chapters/:id')
  update(
    @Param('id') id: string,
    @Body() updateChapterDto: UpdateChapterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chaptersService.update(id, request.user.sub, updateChapterDto);
  }

  @Delete('chapters/:id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.chaptersService.remove(id, request.user.sub);
  }

  @Post('works/:workId/chapters/reorder')
  reorder(
    @Param('workId') workId: string,
    @Body() reorderDto: ReorderChaptersDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.chaptersService.reorder(workId, request.user.sub, reorderDto);
  }
}
