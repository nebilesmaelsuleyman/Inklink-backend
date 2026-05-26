import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ChaptersService } from './chapters.service';

@ApiTags('chapters')
@Controller('chapters')
export class PublicChaptersController {
  constructor(private readonly chaptersService: ChaptersService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  @ApiOperation({
    summary:
      'Get one chapter for reading (content stripped if locked and no access)',
  })
  @ApiParam({ name: 'id', description: 'Chapter id' })
  getPublicById(@Param('id') id: string, @Req() request: any) {
    const userId = request.user?.sub;
    const role = request.user?.role;
    return this.chaptersService.getPublicById(id, userId, role);
  }
}

