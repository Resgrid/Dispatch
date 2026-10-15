export class StatusesResultData {
  public Id: number = 0; // Id of the Set
  public Type: number = 0; // Type of the Set
  public StateId: number = 0; // Custom set id of the option, 0 for a built-in option
  public Text: string = ''; // Button Text
  public BColor: string = ''; // Button Color
  public BaseType?: number | null; // Meaning: ActionBaseTypes for statuses, StaffingBaseTypes for staffing (lib/base-types); -1 none, undefined from older servers
  public Color: string = ''; // Text Color
  public Gps: boolean = false; // Require GPS
  public Note: number = 0; // Note Type
  public Detail: number = 0; // Detail Type
}
