import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Ratings')
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post('work/:workId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rate a work' })
  @ApiResponse({ status: 201, description: 'Rating submitted successfully' })
  async rateWork(
    @Param('workId') workId: string,
    @Body() createRatingDto: CreateRatingDto,
    @Request() req,
  ) {
    return this.ratingsService.rateWork(
      workId,
      req.user.id,
      createRatingDto.value,
    );
  }

  @Get('work/:workId')
  @ApiOperation({ summary: 'Get rating for a work' })
  async getWorkRating(
    @Param('workId') workId: string,
    @Query('userId') userId?: string,
  ) {
    return this.ratingsService.getWorkRating(workId, userId);
  }
}
