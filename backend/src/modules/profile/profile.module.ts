import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { PROFILE_MODEL_NAME, ProfileSchema } from './profile.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PROFILE_MODEL_NAME, schema: ProfileSchema },
    ]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
