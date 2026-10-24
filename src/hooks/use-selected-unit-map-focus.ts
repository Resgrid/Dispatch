import { useMemo } from 'react';

import { createUnitMapFocus, getCrewFocusPinIds, type MapFocus } from '@/lib/unit-map-focus';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { useUnitsStore } from '@/stores/units/store';

/**
 * The console map's focus while the dispatcher has a unit selected: the unit and the members seated in its roles, read
 * from the live units list so a crew change (unitActiveRolesUpdated, then a units refetch) re-frames the map. Null when
 * no unit is selected. Realtime traffic only refreshes the unit; it never touches the selection.
 *
 * The result keeps its identity across refetches that change nothing on the map, so the memoized map does not re-render.
 */
export function useSelectedUnitMapFocus(): MapFocus | null {
  const selectedUnitId = useDispatchConsoleStore((state) => state.selectedUnitId);
  const unit = useUnitsStore((state) => (selectedUnitId ? state.units.find((candidate) => candidate.UnitId === selectedUnitId) : undefined));

  const unitId = unit?.UnitId ?? null;
  const label = unit?.Name ?? '';
  const crewKey = getCrewFocusPinIds(unit).join('|');

  return useMemo(() => (unitId ? createUnitMapFocus(unitId, label, crewKey ? crewKey.split('|') : []) : null), [unitId, label, crewKey]);
}
