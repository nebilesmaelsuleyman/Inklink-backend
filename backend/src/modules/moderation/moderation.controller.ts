
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModerationService } from './moderation.service';
import { Controller,Get } from '@nestjs/common';


@ApiTags('moderation')
@Controller('moderation')
export class ModerationController {constructor(private readonly moderationService: ModerationService) {}


 @Get('ready')
 @ApiOperation({ summary: 'Check moderation service connectivity from backend' })
 async ready() {
   const result = await this.moderationService.moderateText('health check');
   return {
     ok: true,
     moderationDecision: result.decision,
     confidence: result.confidence,
   };
 }
}
