import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChapterDto {
  @ApiProperty({ example: 'Chapter 1' })
  title!: string;

  @ApiPropertyOptional({ example: 'A short chapter summary.' })
  summary?: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  coverImage?: string;

  @ApiPropertyOptional({ example: 'Initial chapter content as plain text.' })
  contentText?: string;

  @ApiPropertyOptional({ example: 0 })
  orderIndex?: number;
}
