export class UnitResultData {
  public UnitId: string = '';
  public DepartmentId: string = '';
  public Name: string = '';
  public Type: string = '';
  public TypeId: number = 0;
  public CustomStatusSetId: string = '';
  public GroupId: string = '';
  public GroupName: string = '';
  public Vin: string = '';
  public PlateNumber: string = '';
  public FourWheelDrive: boolean = false;
  public SpecialPermit: boolean = false;
  public CurrentDestinationId: string = '';
  public CurrentStatusId: string = '';
  public CurrentStatusTimestamp: string = '';
  public Latitude: string = '';
  public Longitude: string = '';
  public Note: string = '';
  /** The department's uploaded icon for the unit's type (absolute URL, anonymous GET, 128x128 PNG); null when none was uploaded or from older servers. */
  public TypeIconUrl?: string | null = null;
  /** The built-in map icon the unit's type picked (lowercase MAP_ICONS key, e.g. "ambulance"); null when none or from older servers. */
  public TypeMapIcon?: string | null = null;
}
