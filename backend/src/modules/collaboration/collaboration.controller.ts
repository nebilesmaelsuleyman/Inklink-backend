import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CollaborationService } from './collaboration.service';

@Controller('collaboration')
@UseGuards(JwtAuthGuard)
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Post('invite')
  async invite(
    @Body() body: { workId: string; emailOrUsername: string },
    @Req() req: any,
  ) {
    return this.collaborationService.inviteCollaborator(
      body.workId,
      req.user.sub,
      body.emailOrUsername,
    );
  }

  @Get('work/:workId')
  async list(@Param('workId') workId: string) {
    return this.collaborationService.getCollaborators(workId);
  }

  @Get('invites')
  async getInvites(@Req() req: any) {
    return this.collaborationService.getUserInvites(req.user.sub);
  }

  @Post('invites/:id/respond')
  async respond(
    @Param('id') id: string,
    @Body() body: { accept: boolean },
    @Req() req: any,
  ) {
    return this.collaborationService.respondToInvite(
      id,
      req.user.sub,
      body.accept,
    );
  }

  @Get('shared-works')
  async getSharedWorks(@Req() req: any) {
    return this.collaborationService.getCollaboratedWorks(req.user.sub);
  }

  @Delete('work/:workId/collaborator/:userId')
  async remove(
    @Param('workId') workId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.collaborationService.removeCollaborator(
      workId,
      userId,
      req.user.sub,
    );
  }
}
