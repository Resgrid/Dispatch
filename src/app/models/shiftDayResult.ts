import { ShiftDaySignupResult } from './shiftDaySignupResult';
import { ShiftDayGroupNeedsResult } from './shiftDayGroupNeedsResult';

export class ShiftDayResult  {
    public ShiftDayId: number = 0;   // Shift Day Id
    public ShiftId: number = 0;    // Shift Id
    public ShiftName: string = "";   // Shift Name
    public ShitDay: string = "";   // The Current Day for this id
    public Start: string = "";   // When does this shift day start
    public End: string = "";   // When does this shift day end
    public ShiftType: number = 0;   // Shift Type
    public SignedUp: boolean = false; // Is the current user signed up for this shift day

    public Signups: ShiftDaySignupResult[];
    public Needs: ShiftDayGroupNeedsResult[];
}