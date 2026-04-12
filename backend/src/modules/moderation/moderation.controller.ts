import {
 ApiBody,
 ApiOkResponse,
 ApiOperation,
 ApiServiceUnavailableResponse,
 ApiTags,
} from '@nestjs/swagger';
import { ModerationService } from './moderation.service';
import { Body, Controller, Get, Post } from '@nestjs/common';
import {
 ModerateTextDto,
 ModerateTextResponseDto,
} from './dto/moderate-text.dto';


@ApiTags('moderation')
@Controller('moderation')
export class ModerationController {constructor(private readonly moderationService: ModerationService) {}


@Get('ready')
@ApiOperation({ summary: 'Check moderation service connectivity from backend' })
async ready() {
  return await this.moderationService.ready();
}



@Post('analyze-text')
@ApiOperation({ summary: 'Analyze frontend text for moderation verdict' })
@ApiBody({ type: ModerateTextDto })
@ApiOkResponse({ type: ModerateTextResponseDto })
@ApiServiceUnavailableResponse({ description: 'Moderation service unavailable' })
async analyzeText(@Body() body: ModerateTextDto): Promise<ModerateTextResponseDto> {
  const result = await this.moderationService.moderateText(body.text);


  const verdict: ModerateTextResponseDto['verdict'] =
    result.decision === 'approved'
      ? 'safe'
      : result.decision === 'rejected'
        ? 'unsafe'
        : 'needs_admin_review';


  return {
    verdict,
    confidence: result.confidence,
    childSafe: result.childSafe,
    adultSafe: result.adultSafe,
    reason: result.reason,
  };
}

}
