export class StaffingScheduleResult  {
    public Id: number = 0;          // Staffing Schedule Id
    public Typ: string = "";        // Type of the Staffing Schedule (Date = 1, Weekly = 2)
    public Act: boolean = false;    // Active

    public Spc: string = "";        // Specific Date Time
    public Dow: string = "";        // Days of the Week
    public Data: string = "";       // What the scedule will change to
    public Not: string = "";        // Note

    public StateColor: string = "";
    public StateText: string = "";
    public Timeframe: string = "";
}