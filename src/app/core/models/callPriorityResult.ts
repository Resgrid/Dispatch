export class CallPriorityResult  {
    public Id: number = 0;   // Call Priority Id
    public DepartmentId: number = 0;   // Department Id for the Call
    public Name: string = "";  // Name of the Priority
    public Color: string = "";  // Color for the Priority
    public Sort: number = 0; // Sort
    public IsDeleted: boolean = false;
    public IsDefault: boolean = false;
    public Tone: number = 0;
}