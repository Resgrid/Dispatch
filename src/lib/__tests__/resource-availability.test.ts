import { describe, expect, it } from '@jest/globals';

import { ActionBaseTypes, StaffingBaseTypes } from '@/lib/base-types';
import { isPersonnelAvailable, isPersonnelAvailableForDashboard, isPersonnelInService, isPersonnelOnDuty, isPersonnelOnDutyForDashboard, isUnitAvailable, isUnitAvailableForDashboard } from '@/lib/resource-availability';
import { type PersonnelInfoResultData } from '@/models/v4/personnel/personnelInfoResultData';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

const unit = (fields: Partial<UnitInfoResultData>): UnitInfoResultData => ({ UnitId: 'u1', Name: 'Engine 1', CurrentStatus: '', CurrentStatusId: '', ...fields }) as UnitInfoResultData;
const person = (fields: Partial<PersonnelInfoResultData>): PersonnelInfoResultData => ({ UserId: 'p1', Status: '', Staffing: '', ...fields }) as PersonnelInfoResultData;

describe('resource availability', () => {
  describe('isUnitAvailable (dispatch console)', () => {
    it('decides by the status base type, whatever the status is called', () => {
      expect(isUnitAvailable(unit({ CurrentStatus: 'IN QUARTERS', CurrentStatusId: '57', CurrentStatusBaseType: ActionBaseTypes.InQuarters }))).toBe(true);
      expect(isUnitAvailable(unit({ CurrentStatus: 'Available', CurrentStatusId: '0', CurrentStatusBaseType: ActionBaseTypes.Responding }))).toBe(false);
      expect(isUnitAvailable(unit({ CurrentStatus: 'Out to lunch', CurrentStatusBaseType: ActionBaseTypes.OnBreak }))).toBe(true);
      expect(isUnitAvailable(unit({ CurrentStatus: 'Shop', CurrentStatusBaseType: ActionBaseTypes.Maintenance }))).toBe(false);
    });

    it('falls back to the status text/id when no base type was sent (older server) or it means nothing', () => {
      expect(isUnitAvailable(unit({ CurrentStatus: 'Available' }))).toBe(true);
      expect(isUnitAvailable(unit({ CurrentStatusId: 'available' }))).toBe(true);
      expect(isUnitAvailable(unit({ CurrentStatus: 'IN QUARTERS', CurrentStatusBaseType: ActionBaseTypes.None }))).toBe(false);
      expect(isUnitAvailable(unit({ CurrentStatus: 'Responding', CurrentStatusBaseType: null }))).toBe(false);
    });

    it('treats a unit with no status at all as available', () => {
      expect(isUnitAvailable(unit({}))).toBe(true);
      expect(isUnitAvailable(unit({ CurrentStatusBaseType: null }))).toBe(true);
    });
  });

  describe('isPersonnelAvailable / isPersonnelOnDuty (dispatch console)', () => {
    it('decides by the base types when sent', () => {
      expect(isPersonnelAvailable(person({ Status: 'Standing By', StatusBaseType: ActionBaseTypes.Available }))).toBe(true);
      expect(isPersonnelAvailable(person({ Status: 'Available', StatusBaseType: ActionBaseTypes.OnScene }))).toBe(false);
      expect(isPersonnelOnDuty(person({ Staffing: 'Pager Only', StaffingBaseType: StaffingBaseTypes.OnCall }))).toBe(true);
      expect(isPersonnelOnDuty(person({ Staffing: 'Home', StaffingBaseType: StaffingBaseTypes.OffDuty }))).toBe(false);
      expect(isPersonnelOnDuty(person({ Staffing: 'Sick', StaffingBaseType: StaffingBaseTypes.Unavailable }))).toBe(false);
    });

    it('falls back to the status and staffing text without a base type', () => {
      expect(isPersonnelAvailable(person({ Status: ' Available ' }))).toBe(true);
      expect(isPersonnelAvailable(person({ Status: 'Standing By' }))).toBe(false);
      expect(isPersonnelAvailable(person({ Status: 'Available', StatusBaseType: ActionBaseTypes.None }))).toBe(true);
      expect(isPersonnelOnDuty(person({ Staffing: 'Unavailable' }))).toBe(true);
      expect(isPersonnelOnDuty(person({ Staffing: 'Off Duty' }))).toBe(false);
      expect(isPersonnelOnDuty(person({ Staffing: '' }))).toBe(false);
      expect(isPersonnelOnDuty(person({ Staffing: 'Off Duty', StaffingBaseType: StaffingBaseTypes.None }))).toBe(false);
    });
  });

  describe('home dashboard rules', () => {
    it('decides by the base types when sent', () => {
      expect(isUnitAvailableForDashboard(unit({ CurrentStatus: 'IN QUARTERS', CurrentStatusBaseType: ActionBaseTypes.InQuarters }))).toBe(true);
      expect(isUnitAvailableForDashboard(unit({ CurrentStatus: 'Standing By', CurrentStatusBaseType: ActionBaseTypes.Standby }))).toBe(false);
      expect(isPersonnelAvailableForDashboard(person({ Status: 'Ready', StatusBaseType: ActionBaseTypes.Available }))).toBe(true);
      expect(isPersonnelAvailableForDashboard(person({ Status: 'Available', StatusBaseType: ActionBaseTypes.Responding }))).toBe(false);
      expect(isPersonnelOnDutyForDashboard(person({ Staffing: 'Unavailable', StaffingBaseType: StaffingBaseTypes.Delayed }))).toBe(true);
      expect(isPersonnelOnDutyForDashboard(person({ Staffing: 'Working', StaffingBaseType: StaffingBaseTypes.OffDuty }))).toBe(false);
    });

    it('falls back to "Available" / "Standing By" text, and never counts a missing status', () => {
      expect(isUnitAvailableForDashboard(unit({ CurrentStatus: 'Standing By' }))).toBe(true);
      expect(isUnitAvailableForDashboard(unit({ CurrentStatus: 'available' }))).toBe(true);
      expect(isUnitAvailableForDashboard(unit({}))).toBe(false);
      expect(isUnitAvailableForDashboard(unit({ CurrentStatus: 'In Quarters', CurrentStatusBaseType: null }))).toBe(false);
      expect(isPersonnelAvailableForDashboard(person({ Status: 'STANDING BY' }))).toBe(true);
      expect(isPersonnelAvailableForDashboard(person({ Status: '' }))).toBe(false);
      expect(isPersonnelOnDutyForDashboard(person({ Staffing: 'On Shift' }))).toBe(true);
      expect(isPersonnelOnDutyForDashboard(person({ Staffing: 'Unavailable' }))).toBe(false);
      expect(isPersonnelOnDutyForDashboard(person({ Staffing: 'Off Duty', StaffingBaseType: StaffingBaseTypes.None }))).toBe(false);
      expect(isPersonnelOnDutyForDashboard(person({ Staffing: '' }))).toBe(false);
    });
  });

  describe('isPersonnelInService (department stats)', () => {
    it('counts people working a status that is not available, unless they are off duty', () => {
      expect(isPersonnelInService(person({ Status: 'Enroute', StatusBaseType: ActionBaseTypes.Enroute, StaffingBaseType: StaffingBaseTypes.OnShift }))).toBe(true);
      expect(isPersonnelInService(person({ Status: 'IN QUARTERS', StatusBaseType: ActionBaseTypes.InQuarters, StaffingBaseType: StaffingBaseTypes.OnShift }))).toBe(false);
      expect(isPersonnelInService(person({ Status: 'Enroute', StatusBaseType: ActionBaseTypes.Enroute, StaffingBaseType: StaffingBaseTypes.OffDuty }))).toBe(false);
    });

    it('keeps the old text rule without base types', () => {
      expect(isPersonnelInService(person({ Status: 'Responding' }))).toBe(true);
      expect(isPersonnelInService(person({ Status: 'Available' }))).toBe(false);
      expect(isPersonnelInService(person({ Status: 'Off Duty' }))).toBe(false);
      expect(isPersonnelInService(person({ Status: '' }))).toBe(false);
      expect(isPersonnelInService(person({ Status: 'Responding', StatusBaseType: ActionBaseTypes.None, StaffingBaseType: StaffingBaseTypes.None }))).toBe(true);
    });
  });
});
