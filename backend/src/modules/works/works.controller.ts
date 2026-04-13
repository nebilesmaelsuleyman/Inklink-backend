import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Delete,
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
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { WorksService } from './works.service';

type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    username: string;
    role: 'user' | 'admin' | 'parent' | 'child';
    parentId?: string;
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

  @Get('browse')
  @ApiOperation({ summary: 'Browse all published works' })
  @ApiQuery({ name: 'tag', required: false })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  browse(@Req() request: AuthenticatedRequest, @Query('tag') tag?: string) {
    return this.worksService.browse(request.user.sub, request.user.role, tag);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one work with chapters' })
  @ApiParam({ name: 'id', description: 'Work id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getById(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.getById(id, request.user.sub, request.user.role);
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

  @Get('admin/moderation/review-queue')
  @UseGuards(AdminRoleGuard)
  @ApiOperation({ summary: 'List works awaiting admin moderation review' })
  reviewQueue() {
    return this.worksService.listReviewQueue();
  }

  @Post('admin/:id/moderation/approve')
  @UseGuards(AdminRoleGuard)
  @ApiOperation({ summary: 'Approve a work in admin moderation review' })
  approveByAdmin(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.adminApprove(id, request.user.sub);
  }

  @Post('admin/:id/moderation/reject')
  @UseGuards(AdminRoleGuard)
  @ApiOperation({ summary: 'Reject a work in admin moderation review' })
  rejectByAdmin(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.adminReject(id, request.user.sub);
  }
  
 @Delete(':id')
 @ApiOperation({ summary: 'Delete work' })
 @ApiParam({ name: 'id', description: 'Work id' })
 @ApiUnauthorizedResponse({ description: 'Unauthorized' })
 delete(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
   return this.worksService.delete(id, request.user.sub);
 }

}
