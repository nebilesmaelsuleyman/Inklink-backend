import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { USER_MODEL_NAME, UserSchema } from './user.schema';

const userImports =
  process.env.DISABLE_DB === 'true'
    ? []
    : [
        MongooseModule.forFeature([
          { name: USER_MODEL_NAME, schema: UserSchema },
        ]),
      ];

@Module({
  imports: [...userImports],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
