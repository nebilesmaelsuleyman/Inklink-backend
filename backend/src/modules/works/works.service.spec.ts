import { WorksService } from './works.service';

describe('WorksService visibility queries', () => {
  it('browse() includes works with approved chapters even if not published/approved', async () => {
    const aggregate = jest.fn().mockResolvedValue([]);

    const workModel: any = {
      aggregate,
    };

    const reactionsService: any = {
      getWorkReactionSummaries: jest.fn().mockResolvedValue(new Map()),
    };

    const service = new WorksService(
      workModel,
      {} as any,
      reactionsService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    (service as any).getAuthorUsernameMap = jest.fn().mockResolvedValue(new Map());

    await service.browse(undefined, undefined, undefined);

    expect(aggregate).toHaveBeenCalledTimes(1);
    const pipeline = aggregate.mock.calls[0][0];

    expect(pipeline[0]).toHaveProperty('$lookup');
    expect(pipeline[1]).toHaveProperty('$match');
    expect(pipeline[1].$match.$or).toEqual([
      { status: { $in: ['published', 'approved'] } },
      { 'visibleChapters.0': { $exists: true } },
    ]);
    expect(pipeline[1].$match.status).toEqual({ $ne: 'rejected' });
  });
});

