import { type UdfFieldValueResultData } from '../userDefinedFields/udfFieldValueResultData';
import { type UnitRoleData } from './unitRoleData';

export class UnitInfoResultData {
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
  /** What CurrentDestinationId is: 1 station, 2 call, 3 POI; null for statuses saved before destinations were typed. */
  public CurrentDestinationType?: number | null = null;
  /**
   * The open call the unit is working, resolved by the server the way it links a status sent without a destination:
   * the call its latest status points at unless that status cleared it, otherwise its one open dispatch.
   */
  public ActiveCallId?: string | null = null;
  public CurrentDestinationName: string = '';
  public CurrentStatusId: string = '';
  public CurrentStatus: string = '';
  public CurrentStatusColor: string = '';
  /**
   * What the current status means (ActionBaseTypes, see lib/base-types), for built-in and department statuses alike;
   * null or -1 when it has no meaning, undefined from older servers. Decide availability from this, not the status text.
   */
  public CurrentStatusBaseType?: number | null;
  public CurrentStatusTimestampUtc: string = '';
  public Latitude: string = '';
  public Longitude: string = '';
  public Note: string = '';
  public Roles: UnitRoleData[] = [];
  public UdfValues: UdfFieldValueResultData[] = [];
  /** The department's uploaded icon for the unit's type (absolute URL, anonymous GET, 128x128 PNG); null when none was uploaded or from older servers. */
  public TypeIconUrl?: string | null = null;
  /** The built-in map icon the unit's type picked (lowercase MAP_ICONS key, e.g. "ambulance"); null when none or from older servers. */
  public TypeMapIcon?: string | null = null;
}
