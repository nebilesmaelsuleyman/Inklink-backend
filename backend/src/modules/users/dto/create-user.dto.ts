import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
	@ApiProperty({ example: 'check' })
	username: string;

	@ApiProperty({ example: '12345678' })
	password: string;

	@ApiPropertyOptional({ example: 'check@gmail.com' })
	email?: string;

	@ApiPropertyOptional({ enum: ['user', 'admin'], example: 'user' })
	role?: 'user' | 'admin';
}
