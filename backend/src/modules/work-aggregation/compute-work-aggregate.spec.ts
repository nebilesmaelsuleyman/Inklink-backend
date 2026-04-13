import {
  computeNextWorkStatus,
  computeWorkAggregateFromChapters,
} from './compute-work-aggregate';

describe('computeWorkAggregateFromChapters', () => {
  it('applies status precedence: rejected > needs_admin_review > pending_moderation > approved > draft', () => {
    const base = {
      title: 'c',
      orderIndex: 0,
      moderationUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    expect(
      computeWorkAggregateFromChapters([
        { ...base, _id: '1', moderationStatus: 'approved' },
        { ...base, _id: '2', moderationStatus: 'draft' },
      ]).derivedStatus,
    ).toBe('draft');

    expect(
      computeWorkAggregateFromChapters([
        { ...base, _id: '1', moderationStatus: 'approved' },
        { ...base, _id: '2', moderationStatus: 'pending_moderation' },
      ]).derivedStatus,
    ).toBe('pending_moderation');

    expect(
      computeWorkAggregateFromChapters([
        { ...base, _id: '1', moderationStatus: 'pending_moderation' },
        { ...base, _id: '2', moderationStatus: 'needs_admin_review' },
      ]).derivedStatus,
    ).toBe('needs_admin_review');

    expect(
      computeWorkAggregateFromChapters([
        { ...base, _id: '1', moderationStatus: 'needs_admin_review' },
        { ...base, _id: '2', moderationStatus: 'rejected' },
      ]).derivedStatus,
    ).toBe('rejected');

    expect(
      computeWorkAggregateFromChapters([
        { ...base, _id: '1', moderationStatus: 'approved' },
        { ...base, _id: '2', moderationStatus: 'approved' },
      ]).derivedStatus,
    ).toBe('approved');
  });

  it('keeps a published work published only when derived status is approved', () => {
    const aggregate = computeWorkAggregateFromChapters([
      {
        _id: '1',
        title: 'Chapter',
        orderIndex: 0,
        moderationStatus: 'needs_admin_review',
        moderationUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    expect(computeNextWorkStatus('published', aggregate.derivedStatus)).toBe(
      'needs_admin_review',
    );
    expect(computeNextWorkStatus('published', 'approved')).toBe('published');
  });

  it('builds chaptersMeta sorted by orderIndex and projects summary/coverImage', () => {
    const result = computeWorkAggregateFromChapters([
      {
        _id: 'b',
        title: 'Two',
        summary: 's2',
        coverImage: 'img2',
        orderIndex: 2,
        moderationStatus: 'approved',
        moderationUpdatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        _id: 'a',
        title: 'One',
        summary: 's1',
        orderIndex: 0,
        moderationStatus: 'approved',
        moderationUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    expect(result.chaptersMeta.map((c) => c.chapterId)).toEqual(['a', 'b']);
    expect(result.chaptersMeta[0]).toMatchObject({
      chapterId: 'a',
      title: 'One',
      summary: 's1',
      coverImage: undefined,
      orderIndex: 0,
      moderationStatus: 'approved',
    });
    expect(result.chaptersMeta[1]).toMatchObject({
      chapterId: 'b',
      title: 'Two',
      summary: 's2',
      coverImage: 'img2',
      orderIndex: 2,
      moderationStatus: 'approved',
    });
  });

  it('uses the most recently-updated contributing chapter as the representative', () => {
    const result = computeWorkAggregateFromChapters([
      {
        _id: '1',
        title: 'One',
        orderIndex: 0,
        moderationStatus: 'needs_admin_review',
        moderationReason: 'older',
        moderationConfidence: 0.1,
        moderationUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        _id: '2',
        title: 'Two',
        orderIndex: 1,
        moderationStatus: 'needs_admin_review',
        moderationReason: 'newer',
        moderationConfidence: 0.9,
        moderationUpdatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      {
        _id: '3',
        title: 'Three',
        orderIndex: 2,
        moderationStatus: 'approved',
        moderationReason: 'ignored',
        moderationUpdatedAt: new Date('2026-01-03T00:00:00.000Z'),
      },
    ]);

    expect(result.derivedStatus).toBe('needs_admin_review');
    expect(result.representative).toMatchObject({
      chapterId: '2',
      moderationReason: 'newer',
      moderationConfidence: 0.9,
    });
  });

  it('aggregates childSafe/adultSafe: any false wins; otherwise undefined propagates', () => {
    const result = computeWorkAggregateFromChapters([
      {
        _id: '1',
        title: 'One',
        orderIndex: 0,
        moderationStatus: 'approved',
        childSafe: true,
        adultSafe: undefined,
      },
      {
        _id: '2',
        title: 'Two',
        orderIndex: 1,
        moderationStatus: 'approved',
        childSafe: false,
        adultSafe: true,
      },
    ]);

    expect(result.childSafe).toBe(false);
    expect(result.adultSafe).toBeUndefined();
  });
});
