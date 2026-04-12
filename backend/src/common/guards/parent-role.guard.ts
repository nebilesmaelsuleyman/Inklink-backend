import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class ParentRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string };
    }>();

    if (!request.user) {
      throw new UnauthorizedException('Unauthorized');
    }

    if (request.user.role !== 'parent' && request.user.role !== 'admin') {
      throw new ForbiddenException('Parent access required');
    }

    return true;
  }
}
