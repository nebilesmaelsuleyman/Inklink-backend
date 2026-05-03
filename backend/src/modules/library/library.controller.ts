import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { LibraryService } from './library.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { UnauthorizedException } from '@nestjs/common';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(
    private readonly libraryService: LibraryService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  getLibrary(@Req() req) {
    return this.libraryService.getLibrary(req.user.sub);
  }

  @Get('child/:childId')
  async getChildLibrary(@Req() req, @Param('childId') childId: string) {
    const parentId = req.user.sub;
    const child = await this.usersService.findOne(childId);

    if (!child || String((child as any).parentId) !== String(parentId)) {
      throw new UnauthorizedException(
        'You are not authorized to view this library',
      );
    }

    return this.libraryService.getLibrary(childId);
  }

  @Post('currently-reading')
  updateCurrentlyReading(
    @Req() req,
    @Body('workId') workId: string,
    @Body('progress') progress: number,
  ) {
    return this.libraryService.updateCurrentlyReading(
      req.user.sub,
      workId,
      progress,
    );
  }

  @Post('bookmarks/toggle')
  toggleBookmark(@Req() req, @Body('workId') workId: string) {
    return this.libraryService.toggleBookmark(req.user.sub, workId);
  }

  @Post('read-lists')
  createReadList(
    @Req() req,
    @Body('name') name: string,
    @Body('description') description: string,
  ) {
    return this.libraryService.createReadList(req.user.sub, name, description);
  }

  @Delete('read-lists/:listId')
  deleteReadList(@Req() req, @Param('listId') listId: string) {
    return this.libraryService.deleteReadList(req.user.sub, listId);
  }

  @Post('read-lists/:listId/toggle-work')
  toggleWorkInReadList(
    @Req() req,
    @Param('listId') listId: string,
    @Body('workId') workId: string,
  ) {
    return this.libraryService.toggleWorkInReadList(
      req.user.sub,
      listId,
      workId,
    );
  }
}
