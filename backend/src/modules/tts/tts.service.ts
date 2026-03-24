import { Injectable, Logger } from '@nestjs/common';
import { setDefaultResultOrder } from 'dns';

// Force IPv4 to avoid ENETUNREACH on broken IPv6 networks
setDefaultResultOrder('ipv4first');

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  /**
   * Synthesizes text to speech using Google Translate's TTS endpoint.
   * - Free, no API key required
   * - Much better quality than browser Web Speech API
   * - Supports English (en) and Amharic (am)
   * - Returns a concatenated MP3 Buffer
   */
  async synthesize(text: string, language: 'en' | 'am'): Promise<Buffer> {
    if (!text?.trim()) {
      throw new Error('Text is required');
    }

    // Google TTS is limited to ~200 chars per request; split at sentence boundaries
    const chunks = this.splitText(text.trim(), 180);
    this.logger.log(
      `Synthesizing ${chunks.length} chunk(s) in "${language}". Total chars: ${text.length}`,
    );

    const buffers: Buffer[] = [];

    // Sequential to avoid rate-limiting
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk.trim()) continue;

      try {
        this.logger.debug(`Chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 40)}..."`);
        const buf = await this.fetchGoogleTTS(chunk, language);
        if (buf.length > 0) {
          buffers.push(buf);
        }
      } catch (err) {
        this.logger.warn(`Chunk ${i + 1} failed: ${err.message}`);
        // Skip the failed chunk; continue with the rest
      }
    }

    if (buffers.length === 0) {
      throw new Error(
        'TTS synthesis failed: could not generate audio for any chunk. ' +
        'Check network connectivity to translate.google.com.',
      );
    }

    this.logger.log(`Synthesis complete. Returning ${buffers.length} buffers concatenated.`);
    return Buffer.concat(buffers);
  }

  /**
   * Fetches a single audio chunk from Google Translate's TTS endpoint.
   */
  private async fetchGoogleTTS(text: string, lang: string): Promise<Buffer> {
    const url = new URL('https://translate.google.com/translate_tts');
    url.searchParams.set('ie', 'UTF-8');
    url.searchParams.set('q', text);
    url.searchParams.set('tl', lang);
    url.searchParams.set('client', 'tw-ob');
    url.searchParams.set('ttsspeed', '1');

    const response = await fetch(url.toString(), {
      headers: {
        // Mimic a browser request so Google doesn't block us
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
        'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`Google TTS returned HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Splits text into chunks ≤ maxLength at sentence/word boundaries.
   * Handles both English (.!?) and Amharic (።፧…) punctuation.
   */
  private splitText(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    // Split at sentence endings first
    const sentences = text.split(/(?<=[.!?።፧…])\s+/);
    let current = '';

    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;

      if (candidate.length <= maxLength) {
        current = candidate;
      } else {
        if (current) chunks.push(current);

        if (sentence.length <= maxLength) {
          current = sentence;
        } else {
          // Hard-split long sentences at word boundaries
          let remaining = sentence;
          while (remaining.length > maxLength) {
            const splitAt = remaining.lastIndexOf(' ', maxLength);
            const cut = splitAt > 0 ? splitAt : maxLength;
            chunks.push(remaining.substring(0, cut).trim());
            remaining = remaining.substring(cut).trim();
          }
          current = remaining;
        }
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(Boolean);
  }
}
