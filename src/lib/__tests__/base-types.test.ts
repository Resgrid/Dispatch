import {
  ActionBaseTypes,
  CallPriorityBaseTypes,
  StaffingBaseTypes,
  comparePriorityUrgency,
  hasBaseType,
  isEmergencyPriority,
  isPersonnelInService,
  isStaffingOnDuty,
  isStatusAvailable,
  isStatusOnScene,
  isStatusResponding,
  staffingAvailability,
  statusAvailability,
} from '../base-types';

describe('base-types', () => {
  it('classifies status meanings like the server availability matrix', () => {
    expect(statusAvailability(ActionBaseTypes.InQuarters)).toBe('available');
    expect(statusAvailability(ActionBaseTypes.Returning)).toBe('committed');
    expect(statusAvailability(ActionBaseTypes.Maintenance)).toBe('unavailable');
    expect(statusAvailability(ActionBaseTypes.OnBreak)).toBe('delayed');
    expect(statusAvailability(ActionBaseTypes.None)).toBe('unknown');
    expect(statusAvailability(undefined)).toBe('unknown');
    expect(statusAvailability('23')).toBe('available');
  });

  it('treats available and delayed statuses as dispatchable', () => {
    expect(isStatusAvailable(ActionBaseTypes.Available)).toBe(true);
    expect(isStatusAvailable(ActionBaseTypes.OnBreak)).toBe(true);
    expect(isStatusAvailable(ActionBaseTypes.Responding)).toBe(false);
    expect(isStatusAvailable(null)).toBe(false);
  });

  it('groups responding and on-scene meanings', () => {
    expect(isStatusResponding(ActionBaseTypes.Dispatched)).toBe(true);
    expect(isStatusResponding(ActionBaseTypes.Enroute)).toBe(true);
    expect(isStatusResponding(ActionBaseTypes.OnScene)).toBe(false);
    expect(isStatusOnScene(ActionBaseTypes.AtPatient)).toBe(true);
    expect(isStatusOnScene(ActionBaseTypes.Returning)).toBe(false);
  });

  it('classifies staffing meanings', () => {
    expect(staffingAvailability(StaffingBaseTypes.OnCall)).toBe('available');
    expect(staffingAvailability(StaffingBaseTypes.OffDuty)).toBe('unavailable');
    expect(isStaffingOnDuty(StaffingBaseTypes.OnShift)).toBe(true);
    expect(isStaffingOnDuty(StaffingBaseTypes.OffDuty)).toBe(false);
    expect(isStaffingOnDuty(StaffingBaseTypes.None)).toBe(false);
  });

  it('counts personnel in service the same way in every app', () => {
    expect(isPersonnelInService({ Status: 'En Route', StatusBaseType: ActionBaseTypes.Enroute, StaffingBaseType: StaffingBaseTypes.Available })).toBe(true);
    expect(isPersonnelInService({ Status: 'Returning', StatusBaseType: ActionBaseTypes.Returning })).toBe(true);
    expect(isPersonnelInService({ Status: 'On Break', StatusBaseType: ActionBaseTypes.OnBreak })).toBe(false);
    expect(isPersonnelInService({ Status: 'Out of Service', StatusBaseType: ActionBaseTypes.Unavailable })).toBe(false);
    expect(isPersonnelInService({ Status: 'Available', StatusBaseType: ActionBaseTypes.Available })).toBe(false);
    expect(isPersonnelInService({ Status: 'Responding', StatusBaseType: ActionBaseTypes.Responding, StaffingBaseType: StaffingBaseTypes.OffDuty })).toBe(false);
    expect(isPersonnelInService({ Status: 'Responding', StatusBaseType: ActionBaseTypes.Responding, StaffingBaseType: StaffingBaseTypes.OnCall })).toBe(true);
  });

  it('uses the old text rule for a status without a meaning', () => {
    expect(isPersonnelInService({ Status: 'Responding' })).toBe(true);
    expect(isPersonnelInService({ Status: 'Code 7', StatusBaseType: -1 })).toBe(true);
    expect(isPersonnelInService({ Status: 'Available' })).toBe(false);
    expect(isPersonnelInService({ Status: 'Off Duty' })).toBe(false);
    expect(isPersonnelInService({ Status: '' })).toBe(false);
    expect(isPersonnelInService(null)).toBe(false);
  });

  it('knows when a meaning was sent', () => {
    expect(hasBaseType(0)).toBe(true);
    expect(hasBaseType(-1)).toBe(false);
    expect(hasBaseType(undefined)).toBe(false);
  });

  it('orders priorities by meaning, then department sort, then id', () => {
    const emergency = { Id: 57, BaseType: CallPriorityBaseTypes.Emergency, Sort: 3 };
    const high = { Id: 2, BaseType: CallPriorityBaseTypes.High, Sort: 0 };
    const unset = { Id: 99, BaseType: CallPriorityBaseTypes.None, Sort: 0 };
    const sorted = [unset, high, emergency].sort(comparePriorityUrgency);
    expect(sorted.map((p) => p.Id)).toEqual([57, 2, 99]);
    expect(isEmergencyPriority(3)).toBe(true);
  });
});
