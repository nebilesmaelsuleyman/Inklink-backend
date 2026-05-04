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
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
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
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List current user works' })
  @ApiQuery({
    name: 'authorId',
    required: false,
    description: 'Must match authenticated user id',
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  list(
    @Req() request: AuthenticatedRequest,
    @Query('authorId') authorId?: string,
  ) {
    return this.worksService.list(request.user.sub, authorId);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('browse')
  @ApiOperation({ summary: 'Browse all published works' })
  @ApiQuery({ name: 'tag', required: false })
  browse(@Req() request: any, @Query('tag') tag?: string) {
    const user = request.user;
    return this.worksService.browse(user?.sub, user?.role, tag);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('search')
  @ApiOperation({ summary: 'Search published works by title or author' })
  @ApiQuery({ name: 'q', required: true })
  search(@Req() request: any, @Query('q') query: string) {
    const user = request.user;
    return this.worksService.search(query, user?.role);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get one work with chapters' })
  @ApiParam({ name: 'id', description: 'Work id' })
  getById(@Param('id') id: string, @Req() request: any) {
    const user = request.user;
    return this.worksService.getById(id, user?.sub, user?.role);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update work metadata (title, summary, coverImage, tags)',
  })
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

  @UseGuards(JwtAuthGuard)
  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish work' })
  @ApiParam({ name: 'id', description: 'Work id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  publish(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.publish(id, request.user.sub);
  }

  @Get('admin/moderation/review-queue')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiOperation({ summary: 'List works awaiting admin moderation review' })
  reviewQueue(@Query('status') status?: string) {
    return this.worksService.listReviewQueue(status);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiOperation({ summary: 'Get admin moderation details for one work' })
  getAdminDetails(@Param('id') id: string) {
    return this.worksService.getAdminDetails(id);
  }

  @Post('admin/:id/moderation/approve')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiOperation({ summary: 'Approve a work in admin moderation review' })
  approveByAdmin(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.worksService.adminApprove(id, request.user.sub);
  }

  @Post('admin/:id/moderation/reject')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiOperation({ summary: 'Reject a work in admin moderation review' })
  rejectByAdmin(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.adminReject(id, request.user.sub);
  }

  @Post('admin/:id/moderation/flag')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @ApiOperation({ summary: 'Flag a work for admin moderation review' })
  flagByAdmin(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.adminFlag(id, request.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete work' })
  @ApiParam({ name: 'id', description: 'Work id' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  delete(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.delete(id, request.user.sub);
  }
}
