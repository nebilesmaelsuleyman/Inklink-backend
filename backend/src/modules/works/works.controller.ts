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

@Controller('works')
@UseGuards(JwtAuthGuard)
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Post()
  create(
    @Body() createWorkDto: CreateWorkDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.worksService.create(request.user.sub, createWorkDto);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query('authorId') authorId?: string) {
    return this.worksService.list(request.user.sub, authorId);
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.getById(id, request.user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateWorkDto: UpdateWorkDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.worksService.update(id, request.user.sub, updateWorkDto);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.worksService.publish(id, request.user.sub);
  }
}
