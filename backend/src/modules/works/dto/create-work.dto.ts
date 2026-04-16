import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkDto {
  @ApiPropertyOptional({
    description:
      'Deprecated: ignored, author is derived from authenticated user',
  })
  authorId?: string;

  @ApiProperty({ example: 'My First Book' })
  title!: string;

  @ApiPropertyOptional({ example: 'A short summary for the editor card.' })
  summary?: string;

  @ApiPropertyOptional({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  coverImage?: string;

  @ApiPropertyOptional({ type: [String], example: ['fantasy', 'adventure'] })
  tags?: string[];
}
