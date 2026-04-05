import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { WorksService } from './works.service';

type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    username: string;
  };
};

@ApiTags('editor-works')
@ApiCookieAuth('auth_token')
@Controller('works')
@UseGuards(JwtAuthGuard)
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new work (book)' })
  @ApiBody({ type: CreateWorkDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(
    @Body() createWorkDto: CreateWorkDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.worksService.create(request.user.sub, createWorkDto);
  }

  @Get()
  @ApiOperation({ summary: 'List current user works' })
  @ApiQuery({ name: 'authorId', required: false, description: 'Must match authenticated user id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(@Req() request: AuthenticatedRequest, @Query('authorId') authorId?: string) {
    return this.worksService.list(request.user.sub, authorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one work with chapters' })
  @ApiParam({ name: 'id', description: 'Work id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getById(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.getById(id, request.user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update work metadata (title, summary, coverImage, tags)' })
  @ApiParam({ name: 'id', description: 'Work id' })
  @ApiBody({ type: UpdateWorkDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(
    @Param('id') id: string,
    @Body() updateWorkDto: UpdateWorkDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.worksService.update(id, request.user.sub, updateWorkDto);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish work' })
  @ApiParam({ name: 'id', description: 'Work id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  publish(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.publish(id, request.user.sub);
  }
}
