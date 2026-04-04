import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';

type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    username: string;
  };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(201)
  async signup(
    @Body() userDto: CreateUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    console.log('[AUTH][SIGNUP][CONTROLLER] received body:', {
      username: userDto?.username,
      email: userDto?.email,
      hasPassword: Boolean(userDto?.password),
      raw: userDto,
    });

    const signupResult = await this.authService.signup(userDto);

    response.cookie(
      this.authService.getAuthCookieName(),
      signupResult.accessToken,
      this.authService.getAuthCookieOptions(),
    );

    return {
      message: 'Signup successful',
      user: signupResult.user,
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() credentials: CreateAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    console.log('[AUTH][LOGIN][CONTROLLER] received body:', {
      username: credentials?.username,
      hasPassword: Boolean(credentials?.password),
      raw: credentials,
    });

    const loginResult = await this.authService.login(credentials);

    response.cookie(
      this.authService.getAuthCookieName(),
      loginResult.accessToken,
      this.authService.getAuthCookieOptions(),
    );

    return {
      message: 'Login successful',
      user: loginResult.user,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Req() request: AuthenticatedRequest) {
    return {
      user: request.user,
    };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(
      this.authService.getAuthCookieName(),
      this.authService.getAuthCookieOptions(),
    );

    return {
      message: 'Logout successful',
    };
  }
}
