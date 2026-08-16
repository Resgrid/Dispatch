export class CallResultData {
  public CallId: string = '';
  public Priority: number = 0;
  public Name: string = '';
  public Nature: string = '';
  public Note: string = '';
  public Address: string = '';
  public DestinationPoiId: number | null = null;
  public DestinationName: string = '';
  public DestinationAddress: string = '';
  public DestinationTypeName: string = '';
  public DestinationPoiTypeId: number | null = null;
  public DestinationLatitude: number | null = null;
  public DestinationLongitude: number | null = null;
  public Geolocation: string = '';
  public LoggedOn: string = '';
  // State: 0 = Active, 1 = Open, 2 = Pending, 3 = Scheduled, 4 = Closed (can be number or string depending on API version)
  public State: number | string = 0;
  public Number: string = '';
  public NotesCount: number = 0;
  public AudioCount: number = 0;
  public ImgagesCount: number = 0;
  public FileCount: number = 0;
  public What3Words: string = '';
  public ContactName: string = '';
  public ContactInfo: string = '';
  public ReferenceId: string = '';
  public ExternalId: string = '';
  public IncidentId: string = '';
  public AudioFileId: string = '';
  public Type: string = 'No Type';
  /**
   * Current alarm level (1-based). Only moves above 1 when the call has been escalated through a
   * run card; the server normalises pre-run-card calls to 1.
   */
  public AlarmLevel: number = 1;
  /** The run card driving this call's dispatch, or null when no card matched. */
  public ActiveRunCardId: number | null = null;
  public LoggedOnUtc: string = '';
  public DispatchedOn: string = '';
  public DispatchedOnUtc: string = '';
  public ScheduledOn: string = '';
  public ScheduledOnUtc: string = '';
  public Latitude: string = '';
  public Longitude: string = '';
  public Protocols: unknown[] = [];
  public UdfValues: unknown[] = [];
  public CheckInTimersEnabled: boolean = false;
}
