import { CalendarItemAttendee } from './calendarItemAttendee'

export class CalendarItem {
    public CalendarItemId: number = 0;    // Call File Id
    public Title: string = "";  // Name of the File
    public Start: string = ""; // Unformatted Timestamp
    public End: string = "";  // Friendly name of the file
    public StartTimezone: string = "";  // URL of the file
    public EndTimezone: string = "";  // User Id
    public Description: string = "";  // Timestamp
    public RecurrenceId: string = ""; // Mime type
    public RecurrenceRule: string = ""; // Mime type
    public RecurrenceException: string = ""; // Mime type
    public ItemType: number = 0;    // Call File Id
    public IsAllDay: boolean = false;    // Call File Id
    public Location: string = ""; // Mime type
    public SignupType: number = 0; // Mime type
    public Reminder: number = 0; // Mime type
    public LockEditing: boolean = false; // Mime type
    public Entities: string = ""; // Mime type
    public RequiredAttendes: string = ""; // Mime type
    public OptionalAttendes: string = ""; // Mime type
    public IsAdminOrCreator: boolean = false; // Mime type
    public CreatorUserId: string = ""; // Mime type
    public Attending: boolean = false; // Mime type

    public Attendees: CalendarItemAttendee[];
}
