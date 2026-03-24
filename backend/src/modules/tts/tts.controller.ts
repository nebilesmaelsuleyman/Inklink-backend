import { Controller, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { TtsService } from './tts.service';
import type { Response } from 'express';

@Controller('tts')
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Post('synthesize')
  async synthesize(
    @Body() body: { text: string; language: 'en' | 'am' },
    @Res() res: Response,
  ) {
    try {
      const { text, language } = body;
      const audioBuffer = await this.ttsService.synthesize(text, language);

      if (!audioBuffer) {
        return res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .send('Failed to synthesize speech');
      }

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
      });

      res.send(audioBuffer);
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(error.message);
    }
  }
}
