import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LibraryService } from './library.service';
import { LibraryController } from './library.controller';
import { LIBRARY_MODEL_NAME, LibrarySchema } from './schemas/library.schema';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LIBRARY_MODEL_NAME, schema: LibrarySchema },
    ]),
    UsersModule,
  ],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
