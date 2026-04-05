import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChapterDto {
  @ApiPropertyOptional({ example: 'Chapter 1 (Edited)' })
  title?: string;

  @ApiPropertyOptional({ example: 'Edited plain text content for this chapter.' })
  contentText?: string;
}
