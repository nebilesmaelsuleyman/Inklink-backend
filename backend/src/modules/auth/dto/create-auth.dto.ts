import { ApiProperty } from '@nestjs/swagger';

export class CreateAuthDto {
  @ApiProperty({ example: 'check@gmail.com' })
  email: string;

  @ApiProperty({ example: '12345678' })
  password: string;
}
