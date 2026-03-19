import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env' });

const optionalImports = process.env.DISABLE_DB === 'true' ? [] : [DatabaseModule];

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
