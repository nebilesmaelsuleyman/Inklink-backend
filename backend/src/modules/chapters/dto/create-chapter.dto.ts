import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChapterDto {
  @ApiProperty({ example: 'Chapter 1' })
  title!: string;

  @ApiPropertyOptional({ example: 'Initial chapter content as plain text.' })
  contentText?: string;

  @ApiPropertyOptional({ example: 0 })
  orderIndex?: number;
}
