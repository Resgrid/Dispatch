import { useCallback } from 'react';

import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';
import { useDispatchConsoleStore } from '@/stores/dispatch/dispatch-console-store';
import { usePersonnelActionsStore } from '@/stores/dispatch/personnel-actions-store';
import { useUnitActionsStore } from '@/stores/dispatch/unit-actions-store';

interface UseSetStatusForCallOptions {
  calls: CallResultData[];
  units: UnitInfoResultData[];
  personnel: PersonnelInfoResultData[];
  selectedCallId: string | null;
  // The dashboard keeps the selected unit/person entities in local state and hands them to the actions panel
  setSelectedUnitData: (unit: UnitInfoResultData | null) => void;
  setSelectedPersonnelData: (person: PersonnelInfoResultData | null) => void;
}

/**
 * Handlers for the dispatch dashboard's "+" set-status-for-call buttons (shown on unit/personnel rows
 * while a call is selected).
 *
 * Selects the unit or person and opens the regular unit/personnel actions panel — the same panel a
 * row selection opens — with the destination preset to the selected call. The dispatcher then picks
 * the status and saves through the normal API path, which sends `RespondingTo` = the call id and
 * `RespondingToType` = Call so the server's call reports link the status change to the call.
 */
export function useSetStatusForCall({ calls, units, personnel, selectedCallId, setSelectedUnitData, setSelectedPersonnelData }: UseSetStatusForCallOptions) {
  const setSelectedUnitId = useDispatchConsoleStore((s) => s.setSelectedUnitId);
  const setSelectedPersonnelId = useDispatchConsoleStore((s) => s.setSelectedPersonnelId);
  const openUnitActions = useUnitActionsStore((s) => s.openActions);
  const openPersonnelActions = usePersonnelActionsStore((s) => s.openActions);

  const findSelectedCall = useCallback(() => (selectedCallId ? (calls.find((c) => c.CallId === selectedCallId) ?? null) : null), [calls, selectedCallId]);

  const handleSetUnitStatusForCall = useCallback(
    (unitId: string) => {
      const unit = units.find((u) => u.UnitId === unitId);
      if (!unit) return;

      // Units and personnel are mutually exclusive selections on the dashboard
      setSelectedPersonnelId(null);
      setSelectedPersonnelData(null);
      setSelectedUnitId(unitId);
      setSelectedUnitData(unit);
      openUnitActions(unit, { callContext: findSelectedCall() });
    },
    [units, findSelectedCall, setSelectedPersonnelId, setSelectedPersonnelData, setSelectedUnitId, setSelectedUnitData, openUnitActions]
  );

  const handleSetPersonnelStatusForCall = useCallback(
    (personnelId: string) => {
      const person = personnel.find((p) => p.UserId === personnelId);
      if (!person) return;

      setSelectedUnitId(null);
      setSelectedUnitData(null);
      setSelectedPersonnelId(personnelId);
      setSelectedPersonnelData(person);
      openPersonnelActions(person, { callContext: findSelectedCall() });
    },
    [personnel, findSelectedCall, setSelectedUnitId, setSelectedUnitData, setSelectedPersonnelId, setSelectedPersonnelData, openPersonnelActions]
  );

  return { handleSetUnitStatusForCall, handleSetPersonnelStatusForCall };
}
