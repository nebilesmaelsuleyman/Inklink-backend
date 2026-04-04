import { ApiProperty } from '@nestjs/swagger';

export class CreateAuthDto {
	@ApiProperty({ example: 'check' })
	username: string;

	@ApiProperty({ example: '12345678' })
	password: string;
}
