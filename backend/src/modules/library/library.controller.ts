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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; // Assume this exists in common/auth module

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  getLibrary(@Req() req) {
    return this.libraryService.getLibrary(req.user.sub);
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
