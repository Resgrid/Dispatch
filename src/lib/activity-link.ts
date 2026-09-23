import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';

/**
 * Server `StatusDestinationSources`: how a status entry in a call's `Activity` came to be tied to the call.
 * Carried on `DispatchedEventResultData.DestinationSource`.
 */
export enum StatusDestinationSources {
  /** The sender chose the call. */
  Explicit = 1,
  /** Sent without a call; linked from the unit's/person's previous status. */
  CarryForward = 2,
  /** Sent without a call; linked from the sender's one open dispatch. */
  Dispatch = 3,
  /** Sent without a call by a person; linked from the unit they rode. */
  Unit = 4,
  /** Set with no destination by a resource dispatched to the call while working it (derived at read time, not stored). */
  Inferred = 5,
}

/** The marker a status entry carries: `auto` = auto-linked by the server, `inferred` = attributed at read time. */
export type ActivityLinkKind = 'auto' | 'inferred';

/** Maps a `DestinationSource` to its marker; `null` for explicit entries, older rows and non-status entries. */
export function getActivityLinkKind(source: number | null | undefined): ActivityLinkKind | null {
  switch (source) {
    case StatusDestinationSources.CarryForward:
    case StatusDestinationSources.Dispatch:
    case StatusDestinationSources.Unit:
      return 'auto';
    case StatusDestinationSources.Inferred:
      return 'inferred';
    default:
      return null;
  }
}

/** The distinct markers present in an activity list, in display order (`auto` before `inferred`). */
export function getActivityLinkKinds(activity: readonly Pick<DispatchedEventResultData, 'DestinationSource'>[] | null | undefined): ActivityLinkKind[] {
  if (!activity || activity.length === 0) return [];
  const present = new Set<ActivityLinkKind>();
  for (const item of activity) {
    const kind = getActivityLinkKind(item?.DestinationSource);
    if (kind) present.add(kind);
  }
  return (['auto', 'inferred'] as const).filter((kind) => present.has(kind));
}
