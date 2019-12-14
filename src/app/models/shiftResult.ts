import { ShiftDay } from './shiftDay';

export class ShiftResult  {
    public Id: number = 0;    // Shift Id
    public Name: string = "";   // Shift Name
    public Code: string = "";   // Code
    public Color: string = "";   // Shift Color
    public SType: number = 0;   // Shift Type
    public AType: number = 0;   // Assignment Type
    public InShift: boolean = false;   // Is Current User in this Shift
    public PCount: number = 0;   // Personnel in Shift
    public GCount: number = 0;   // Groups in Shift
    public NextDay: string = "";   // Next Day Shift is on
    public NextDayId: number = 0;   // next Shift Day Id

    public Days: ShiftDay[];
}