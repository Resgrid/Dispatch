import { getActivityLinkKind, getActivityLinkKinds, StatusDestinationSources } from '../activity-link';

describe('getActivityLinkKind', () => {
  it.each([
    [StatusDestinationSources.CarryForward, 'auto'],
    [StatusDestinationSources.Dispatch, 'auto'],
    [StatusDestinationSources.Unit, 'auto'],
    [StatusDestinationSources.Inferred, 'inferred'],
  ])('maps source %p to %p', (source, expected) => {
    expect(getActivityLinkKind(source)).toBe(expected);
  });

  it.each([[StatusDestinationSources.Explicit], [null], [undefined], [0], [6], [-1]])('returns null for source %p', (source) => {
    expect(getActivityLinkKind(source)).toBeNull();
  });

  it('matches the server StatusDestinationSources values', () => {
    expect(StatusDestinationSources.Explicit).toBe(1);
    expect(StatusDestinationSources.CarryForward).toBe(2);
    expect(StatusDestinationSources.Dispatch).toBe(3);
    expect(StatusDestinationSources.Unit).toBe(4);
    expect(StatusDestinationSources.Inferred).toBe(5);
  });
});

describe('getActivityLinkKinds', () => {
  it('returns nothing for an empty or missing list', () => {
    expect(getActivityLinkKinds(undefined)).toEqual([]);
    expect(getActivityLinkKinds(null)).toEqual([]);
    expect(getActivityLinkKinds([])).toEqual([]);
  });

  it('returns nothing when no entry is marked', () => {
    expect(getActivityLinkKinds([{ DestinationSource: 1 }, { DestinationSource: null }, {}])).toEqual([]);
  });

  it('returns each present kind once, auto before inferred', () => {
    expect(getActivityLinkKinds([{ DestinationSource: 5 }, { DestinationSource: 2 }, { DestinationSource: 4 }, { DestinationSource: 5 }])).toEqual(['auto', 'inferred']);
    expect(getActivityLinkKinds([{ DestinationSource: 3 }, { DestinationSource: 1 }])).toEqual(['auto']);
    expect(getActivityLinkKinds([{ DestinationSource: 5 }])).toEqual(['inferred']);
  });
});
