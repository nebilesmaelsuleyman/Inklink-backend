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
import {
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    username: string;
    role: 'user' | 'admin';
  };
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new account and set auth cookie' })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({
    description:
      'Signup successful. JWT is returned in Set-Cookie (httpOnly) and not in response body.',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'username and password are required' })
  @ApiConflictResponse({ description: 'Username already exists' })
  async signup(
    @Body() userDto: CreateUserDto,
    @Res({ passthrough: true }) response: Response,
  ) {
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
  @ApiOperation({
    summary: 'Login with username and password and set auth cookie',
  })
  @ApiBody({ type: CreateAuthDto })
  @ApiOkResponse({
    description:
      'Login successful. JWT is returned in Set-Cookie (httpOnly) and not in response body.',
    type: AuthResponseDto,
  })
  @ApiBadRequestResponse({ description: 'username and password are required' })
  @ApiUnauthorizedResponse({ description: 'Invalid username or password' })
  async login(
    @Body() credentials: CreateAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
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
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiCookieAuth('auth_token')
  @ApiOkResponse({ description: 'Current authenticated user' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  getMe(@Req() request: AuthenticatedRequest) {
    return {
      user: request.user,
    };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clear auth cookie and log out' })
  @ApiCookieAuth('auth_token')
  @ApiOkResponse({ description: 'Logout successful' })
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
