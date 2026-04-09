
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModerationService } from './moderation.service';
import { Controller } from '@nestjs/common';


@ApiTags('moderation')
@Controller('moderation')
export class ModerationController {}