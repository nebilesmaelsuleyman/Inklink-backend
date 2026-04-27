import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({ example: 5, description: 'Rating value from 1 to 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  value: number;
}
