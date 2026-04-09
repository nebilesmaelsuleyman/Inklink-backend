import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const cookieName =
            configService.get<string>('auth.cookieName') || 'auth_token';
          return request?.cookies?.[cookieName] || null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('auth.jwtSecret') || 'change-me-in-env',
    });
  }

  validate(payload: { sub: string; username: string; role?: 'user' | 'admin' }) {
    return {
      sub: payload.sub,
      username: payload.username,
      role: payload.role || 'user',
    };
  }
}
