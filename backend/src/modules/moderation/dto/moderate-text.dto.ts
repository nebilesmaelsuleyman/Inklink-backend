import { ApiProperty } from '@nestjs/swagger';

export class ModerateTextDto {
  @ApiProperty({
    example: 'This is a sample chapter paragraph from the editor.',
    description: 'Raw text content from frontend to be analyzed by moderation service',
  })
  text!: string;
}

export class ModerateTextResponseDto {
  @ApiProperty({
    enum: ['safe', 'unsafe', 'needs_admin_review'],
    example: 'safe',
  })
  verdict!: 'safe' | 'unsafe' | 'needs_admin_review';

  @ApiProperty({ example: 0.94 })
  confidence!: number;

  @ApiProperty({ example: true })
  childSafe!: boolean;

  @ApiProperty({ example: true })
  adultSafe!: boolean;

  @ApiProperty({ example: 'auto_approved_high_confidence_safe' })
  reason!: string;
}
