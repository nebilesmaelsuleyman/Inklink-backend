import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({
    enum: ['weekly', 'monthly', 'yearly'],
    description: 'Subscription plan type',
  })
  @IsNotEmpty()
  @IsEnum(['weekly', 'monthly', 'yearly'])
  plan: 'weekly' | 'monthly' | 'yearly';
}
