import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ParentRoleGuard } from '../../common/guards/parent-role.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('children')
  @UseGuards(JwtAuthGuard, ParentRoleGuard)
  createChild(@Req() req: any, @Body() createUserDto: CreateUserDto) {
    createUserDto.role = 'child';
    createUserDto.parentId = req.user.sub;
    return this.usersService.create(createUserDto);
  }

  @Get('children')
  @UseGuards(JwtAuthGuard, ParentRoleGuard)
  getChildren(@Req() req: any) {
    return this.usersService.findChildren(req.user.sub);
  }

  @Delete('children/:id')
  @UseGuards(JwtAuthGuard, ParentRoleGuard)
  removeChild(@Req() req: any, @Param('id') id: string) {
    return this.usersService.removeChild(req.user.sub, id);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
