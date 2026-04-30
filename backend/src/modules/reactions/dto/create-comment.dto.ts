import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'Amazing chapter! I loved the twist.' })
  text!: string;
}
