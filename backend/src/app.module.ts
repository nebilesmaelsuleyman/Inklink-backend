import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import configuration from './config/configuration';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { ChaptersModule } from './modules/chapters/chapters.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { UsersModule } from './modules/users/users.module';
import { WorksModule } from './modules/works/works.module';
import { YjsModule } from './modules/yjs/yjs.module';
import { LibraryModule } from './modules/library/library.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProfileModule } from './modules/profile/profile.module';
import { ReactionsModule } from './modules/reactions/reactions.module';
import { RatingsModule } from './modules/ratings/ratings.module';


loadEnv({ path: '.env' });

const optionalImports =
  process.env.DISABLE_DB === 'true'
    ? []
    : [
        DatabaseModule,
        ChatModule,
        WorksModule,
        ChaptersModule,
        ReactionsModule,
        RatingsModule,
        YjsModule,
      ];

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
    ModerationModule,
    LibraryModule,
    NotificationsModule,
    ProfileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
