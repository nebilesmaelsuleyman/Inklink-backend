import { ApiPropertyOptional } from '@nestjs/swagger';
import type { WorkStatus } from '../schema/work.schema';

export class UpdateWorkDto {
  @ApiPropertyOptional({ example: 'My First Book (Updated)' })
  title?: string;

  @ApiPropertyOptional({ example: 'Updated summary text.' })
  summary?: string;

  @ApiPropertyOptional({ example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...' })
  coverImage?: string;

  @ApiPropertyOptional({ type: [String], example: ['romance', 'drama'] })
  tags?: string[];

  @ApiPropertyOptional({ enum: ['draft', 'published'], example: 'draft' })
  status?: WorkStatus;
}
