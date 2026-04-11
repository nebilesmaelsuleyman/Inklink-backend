import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChapterDto {
  @ApiPropertyOptional({ example: 'Chapter 1 (Edited)' })
  title?: string;
  @ApiPropertyOptional({ example: 'A short chapter summary.' })
 summary?: string;


 @ApiPropertyOptional({ example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...' })
 coverImage?: string;

  @ApiPropertyOptional({ example: 'Edited plain text content for this chapter.' })
  contentText?: string;
}
