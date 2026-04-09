import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: 'user' | 'admin' };
    }>();

    if (!request.user) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (request.user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
