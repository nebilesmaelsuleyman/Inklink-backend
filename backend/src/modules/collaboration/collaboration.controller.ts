import { Controller } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';

@Controller('collaboration')
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}
}
