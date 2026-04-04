import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions } from 'express';
import { compare } from 'bcryptjs';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

type AuthenticatedUser = {
  sub: string;
  username: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async login(credentials: CreateAuthDto) {
    console.log('[AUTH][LOGIN][SERVICE] input:', {
      username: credentials?.username,
      hasPassword: Boolean(credentials?.password),
    });

    if (!credentials?.username || !credentials?.password) {
      throw new BadRequestException('username and password are required');
    }

    const user = await this.validateCredentials(credentials);
    console.log('[AUTH][LOGIN][SERVICE] validation result:', {
      foundUser: Boolean(user),
      username: user?.username,
      sub: user?.sub,
    });

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const accessToken = await this.jwtService.signAsync(user);

    console.log('[AUTH][LOGIN][SERVICE] token issued for user:', user.username);

    return {
      accessToken,
      user,
    };
  }

  async signup(userDto: CreateUserDto) {
    console.log('[AUTH][SIGNUP][SERVICE] input:', {
      username: userDto?.username,
      email: userDto?.email,
      hasPassword: Boolean(userDto?.password),
    });

    if (!userDto?.username || !userDto?.password) {
      throw new BadRequestException('username and password are required');
    }

    const existingUser = await this.usersService.findByUsername(userDto.username);
    console.log('[AUTH][SIGNUP][SERVICE] existing user found:', Boolean(existingUser));

    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    let createdUser: { _id: unknown; username: string } | null = null;

    try {
      createdUser = await this.usersService.create(userDto);
    } catch {
      throw new ConflictException('Username already exists');
    }

    if (!createdUser) {
      throw new InternalServerErrorException('Unable to create user');
    }

    console.log('[AUTH][SIGNUP][SERVICE] created user:', {
      id: String(createdUser._id),
      username: createdUser.username,
    });

    const user = {
      sub: String(createdUser._id),
      username: createdUser.username,
    };

    const accessToken = await this.jwtService.signAsync(user);

    console.log('[AUTH][SIGNUP][SERVICE] token issued for user:', user.username);

    return {
      accessToken,
      user,
    };
  }

  getAuthCookieName(): string {
    return this.configService.get<string>('auth.cookieName') || 'auth_token';
  }

  getAuthCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.get<boolean>('auth.cookieSecure') || false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    };
  }

  private async validateCredentials(
    credentials: CreateAuthDto,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.usersService.findByUsername(credentials.username);

    if (!user) {
      return null;
    }

    const isPasswordValid = await compare(credentials.password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return {
      sub: String(user._id),
      username: user.username,
    };
  }
}
