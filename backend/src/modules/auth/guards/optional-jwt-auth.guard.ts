import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err, user) {
    // If there's an error or no user, just return null instead of throwing an exception.
    // This allows the request to continue with request.user being undefined/null.
    return user || null;
  }
}
