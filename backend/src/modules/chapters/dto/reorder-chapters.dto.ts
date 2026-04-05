import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReorderChaptersDto {
  @ApiPropertyOptional({
    type: [String],
    example: ['67f08df9b9e3adf31f5f4701', '67f08df9b9e3adf31f5f4702'],
  })
  chapterIds?: string[];

  @ApiPropertyOptional({
    type: 'array',
    example: [
      { id: '67f08df9b9e3adf31f5f4701', orderIndex: 0 },
      { id: '67f08df9b9e3adf31f5f4702', orderIndex: 1 },
    ],
  })
  orders?: Array<{ id: string; orderIndex: number }>;
}
