import { mergeStatusDestinationDetails } from '@/lib/destination-helpers';
import { type StatusesResultData } from '@/models/v4/statuses/statusesResultData';
import { type UnitTypeStatusResultData } from '@/models/v4/statuses/unitTypeStatusResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

/**
 * Resolves the correct selectable status options for a unit.
 *
 * A unit's status set is authoritatively identified by its `CustomStatusSetId` (the department's
 * custom-state-set id) or, secondarily, its unit-type name. The grouped `GetAllUnitStatuses`
 * response (`UnitTypeStatusResultData[]`) carries `StatusId` (== the set id) and `UnitType` (== the
 * type name) per group, so matching by id here is reliable — unlike the server's per-unit endpoint
 * which resolves the type by name and silently falls back to the default statuses on a mismatch.
 *
 * Only the statuses attached to the unit's type are returned. When no custom-set group matches (i.e.
 * the unit type has no custom statuses), the department default group (`UnitType === '0'`) is used
 * before the server-provided per-unit list: the default group carries the real default unit statuses
 * with their destination `Detail` types (Responding / On Scene / Staging accept calls), whereas older
 * servers answer the per-unit endpoint with a Detail-0 list that can never carry a call destination.
 * The per-unit list is only the last resort, when the grouped response has no default group.
 */
export function resolveUnitStatusOptions(
  unit: Pick<UnitInfoResultData, 'CustomStatusSetId' | 'Type'> | null | undefined,
  groups: UnitTypeStatusResultData[] | undefined,
  fallback: StatusesResultData[] = []
): StatusesResultData[] {
  const list = groups ?? [];

  // 1. Exact custom-status-set match by id (most reliable).
  if (unit?.CustomStatusSetId) {
    const byId = list.find((group) => !!group.StatusId && group.StatusId === unit.CustomStatusSetId);
    if (byId?.Statuses?.length) return byId.Statuses;
  }

  // 2. Match by unit-type name.
  if (unit?.Type) {
    const byType = list.find((group) => !!group.UnitType && group.UnitType === unit.Type);
    if (byType?.Statuses?.length) return byType.Statuses;
  }

  // 3. Department default unit statuses (the "0" group), which carry the proper Detail types.
  const defaultGroup = list.find((group) => group.UnitType === '0');
  if (defaultGroup?.Statuses?.length) return defaultGroup.Statuses;

  // 4. Server-provided per-unit list (last resort when the grouped response has no default group).
  return fallback;
}

/** A status that every unit of a multi-unit selection can be set to (see {@link resolveCommonUnitStatusOptions}). */
export interface CommonUnitStatusOption {
  /** The status text, trimmed and lower-cased: what identifies the status across the units' status sets. */
  key: string;
  /** The first unit's status, for display (text and colour). */
  status: StatusesResultData;
  /** Each unit's own status for this option: the id (and destination type) its status set uses. */
  statusByUnitId: Record<string, StatusesResultData>;
  /** Every destination kind any unit's status accepts (see `mergeStatusDestinationDetails`). */
  detail: number;
  /** A note is required when any unit's status requires one. */
  noteRequired: boolean;
}

export const getUnitStatusKey = (status: Pick<StatusesResultData, 'Text'>): string => (status.Text ?? '').trim().toLowerCase();

/**
 * The statuses a group of units can all be set to in one action. Units of different types can use different custom
 * status sets, where the "same" status (e.g. "At Hospital" for an ambulance and for an MUG) has a different id per
 * set, so statuses are matched by their text and each unit keeps its own status id. Ordered as the first unit's set.
 *
 * `fallbackByUnitId` holds per-unit status lists (see {@link resolveUnitStatusOptions}), keyed by the unit they were
 * fetched for: one unit's list carries its own set's ids, so it is never used for another unit. A unit with neither a
 * group nor its own list has no statuses, which leaves the selection without common options rather than sending it
 * another set's ids.
 */
export function resolveCommonUnitStatusOptions(
  units: Pick<UnitInfoResultData, 'UnitId' | 'CustomStatusSetId' | 'Type'>[],
  groups: UnitTypeStatusResultData[] | undefined,
  fallbackByUnitId: Record<string, StatusesResultData[]> = {}
): CommonUnitStatusOption[] {
  if (units.length === 0) return [];

  const statusesByUnit = units.map((unit) => {
    const byKey = new Map<string, StatusesResultData>();
    resolveUnitStatusOptions(unit, groups, fallbackByUnitId[unit.UnitId]).forEach((status) => {
      const key = getUnitStatusKey(status);
      if (key && !byKey.has(key)) byKey.set(key, status);
    });
    return { unitId: unit.UnitId, byKey };
  });

  const [first, ...rest] = statusesByUnit;
  const options: CommonUnitStatusOption[] = [];
  first.byKey.forEach((status, key) => {
    if (!rest.every((entry) => entry.byKey.has(key))) return;

    const statusByUnitId: Record<string, StatusesResultData> = {};
    statusesByUnit.forEach((entry) => {
      statusByUnitId[entry.unitId] = entry.byKey.get(key)!;
    });
    const unitStatuses = Object.values(statusByUnitId);
    options.push({
      key,
      status,
      statusByUnitId,
      detail: mergeStatusDestinationDetails(unitStatuses.map((s) => s.Detail)),
      noteRequired: unitStatuses.some((s) => s.Note === 2),
    });
  });
  return options;
}
