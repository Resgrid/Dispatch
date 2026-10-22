export class UnitStatusResultData {
  public Name: string = '';
  public Type: string = '';
  public State: string = '';
  public StateCss: string = '';
  public StateStyle: string = '';
  public Timestamp: string = '';
  public TimestampUtc: string = '';
  public DestinationId: number | null = null;
  public DestinationType: number | null = null;
  public DestinationName: string = '';
  public DestinationAddress: string = '';
  public DestinationTypeName: string = '';
  public Note: string = '';
  public Latitude: number | null = null;
  public Longitude: number | null = null;
  public GroupName: string = '';
  public GroupId: number = 0;
  public Eta: string = '';
  public UnitId: string = '';
  /** The department's uploaded icon for the unit's type (absolute URL, anonymous GET, 128x128 PNG); null when none was uploaded or from older servers. */
  public TypeIconUrl?: string | null = null;
  /** The built-in map icon the unit's type picked (lowercase MAP_ICONS key, e.g. "ambulance"); null when none or from older servers. */
  public TypeMapIcon?: string | null = null;
}
