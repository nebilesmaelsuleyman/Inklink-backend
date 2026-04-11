import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { ModerationService } from './moderation.service';

describe('ModerationService', () => {
  let service: ModerationService;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'moderation.baseUrl') return 'http://localhost:8000';
              if (key === 'moderation.requestTimeoutMs') return 6000;
              if (key === 'moderation.safeConfidenceThreshold') return 0.88;
              if (key === 'moderation.unsafeConfidenceThreshold') return 0.88;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('approves empty text without calling moderation service', async () => {
    global.fetch = jest.fn();
    const result = await service.moderateText('   ');
    expect(result.decision).toBe('approved');
    expect(result.reason).toBe('empty_text_auto_approved');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps high-confidence safe payload to approved', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        child_safe: true,
        adult_safe: true,
        confidence: 0.95,
      }),
    });

    const result = await service.moderateText('hello world');
    expect(result.decision).toBe('approved');
    expect(result.confidence).toBe(0.95);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('throws when moderation HTTP fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    await expect(service.moderateText('x')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
