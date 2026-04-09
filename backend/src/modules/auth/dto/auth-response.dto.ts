import { ApiProperty } from '@nestjs/swagger';

class AuthUserDto {
  @ApiProperty({ example: '67f08df9b9e3adf31f5f4701' })
  sub: string;

  @ApiProperty({ example: 'check' })
  username: string;

  @ApiProperty({ enum: ['user', 'admin'], example: 'user' })
  role: 'user' | 'admin';
}

export class AuthResponseDto {
  @ApiProperty({ example: 'Login successful' })
  message: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
