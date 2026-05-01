import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: any, @Body() createPostDto: CreatePostDto) {
    const userId = req.user.sub || req.user.id;
    return this.postsService.create(userId, createPostDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('feed')
  async getFeed(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.postsService.getFeed(userId);
  }

  @Get('author/:authorId')
  async findByAuthor(@Param('authorId') authorId: string) {
    return this.postsService.findByAuthor(authorId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/like')
  async like(@Req() req: any, @Param('id') postId: string) {
    const userId = req.user.sub || req.user.id;
    return this.postsService.likePost(userId, postId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/dismiss')
  async dismiss(@Req() req: any, @Param('id') postId: string) {
    const userId = req.user.sub || req.user.id;
    return this.postsService.dismissPost(userId, postId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Req() req: any, @Param('id') postId: string) {
    const userId = req.user.sub || req.user.id;
    return this.postsService.delete(userId, postId);
  }
}
