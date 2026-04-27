import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../../common/guards/admin-role.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('users')
  getUsers(@Query('search') search?: string) {
    return this.adminService.getUsers(search);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('authors')
  getAuthors(
    @Query('search') search?: string,
    @Query('monetized') monetized?: string,
  ) {
    return this.adminService.getAuthors(search, monetized);
  }

  @Patch('authors/:id/monetization')
  updateAuthorMonetization(
    @Param('id') id: string,
    @Body() body: { isMonetized?: boolean },
  ) {
    return this.adminService.updateAuthorMonetization(id, body?.isMonetized);
  }

  @Delete('authors/:id')
  deleteAuthor(@Param('id') id: string) {
    return this.adminService.deleteAuthor(id);
  }

  @Get('content')
  getContent(
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getContent(search, status);
  }

  @Patch('content/:id/publish')
  publishContent(@Param('id') id: string, @Req() req: any) {
    return this.adminService.publishContent(id, req.user?.sub);
  }

  @Delete('content/:id')
  deleteContent(@Param('id') id: string) {
    return this.adminService.deleteContent(id);
  }

  @Get('pricing')
  getPricing() {
    return this.adminService.getPricing();
  }

  @Put('pricing')
  updatePricing(
    @Body()
    body: {
      plans?: Array<{
        id: string;
        name: string;
        price: number;
        currency: string;
        period: string;
      }>;
    },
  ) {
    return this.adminService.updatePricing(body?.plans || []);
  }
}
