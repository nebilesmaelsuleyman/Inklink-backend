import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModerationResult } from './moderation.types';


@Injectable()
export class ModerationService {

  constructor(private readonly configService: ConfigService) {}


 private get baseUrl() {
   return (
     this.configService.get<string>('moderation.baseUrl') ||
     'http://localhost:8000'
   );
 }


 private get timeoutMs() {
   return this.configService.get<number>('moderation.requestTimeoutMs') || 6000;
 }

 private get safeConfidenceThreshold() {
   return (
     this.configService.get<number>('moderation.safeConfidenceThreshold') || 0.88
   );
 }

  private get unsafeConfidenceThreshold() {
   return (
     this.configService.get<number>('moderation.unsafeConfidenceThreshold') ||
     0.88
   );
 }


}
