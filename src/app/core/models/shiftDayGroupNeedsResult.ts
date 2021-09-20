import { ShiftDayGroupRoleNeedsResult } from './shiftDayGroupRoleNeedsResult';

export class ShiftDayGroupNeedsResult  {
    public GroupId: number = 0;   // GroupId for this need
    public GroupNeeds: ShiftDayGroupRoleNeedsResult[];       // Roles that are needed

    public GroupName: string = "";
}