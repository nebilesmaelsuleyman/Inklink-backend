import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { WsAdapter } from '@nestjs/platform-ws';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorksModule } from './modules/works/works.module';
import { ChaptersModule } from './modules/chapters/chapters.module';
import { YjsModule } from './modules/yjs/yjs.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  app.use(cookieParser());
  app.enableCors({
    origin:'http://localhost:3000',
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ink Link Backend API')
    .setDescription('Authentication + Editor (Works, Chapters, Yjs collaboration persistence) endpoints')
    .setVersion('1.0')
    .addCookieAuth('auth_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'auth_token',
    })
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    include: [AuthModule, WorksModule, ChaptersModule, YjsModule],
  });

  SwaggerModule.setup('api/docs', app, document);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 4000;
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
}
bootstrap();
