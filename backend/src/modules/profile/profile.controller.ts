import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':id')
  async getProfile(@Param('id') id: string) {
    return this.profileService.getProfile(id);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req: any, @Body() updates: any) {
    // req.user.sub is typically where the user ID is in NestJS/Passport JWT
    const userId = req.user.sub || req.user.id;
    return this.profileService.updateProfile(userId, updates);
  }

  @Post('follow/:id')
  @UseGuards(JwtAuthGuard)
  async followUser(@Req() req: any, @Param('id') targetId: string) {
    const currentUserId = req.user.sub || req.user.id;
    return this.profileService.followUser(currentUserId, targetId);
  }
}
