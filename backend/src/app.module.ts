import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { ChatModule } from './modules/chat/chat.module';
import { WorksModule } from './modules/works/works.module';
import { ChaptersModule } from './modules/chapters/chapters.module';
import { YjsModule } from './modules/yjs/yjs.module';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env' });

const optionalImports =
  process.env.DISABLE_DB === 'true'
    ? []
    : [DatabaseModule, ChatModule, WorksModule, ChaptersModule, YjsModule];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
    }),
    ...optionalImports,
    AuthModule,
    UsersModule,
    CollaborationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
