export class CallPriorityResultData {
  public Id: number = 0; // Call Priority Id
  public DepartmentId: number = 0; // Department Id for the Call
  public Name: string = ''; // Name of the Priority
  public Color: string = ''; // Color for the Priority
  public Sort: number = 0; // Sort
  public BaseType?: number | null; // Meaning (CallPriorityBaseTypes): 0 Low, 1 Medium, 2 High, 3 Emergency, -1 not set; undefined from older servers
  public IsDeleted: boolean = false;
  public IsDefault: boolean = false;
  public Tone: number = 0;
}
