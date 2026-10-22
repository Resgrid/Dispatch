import { type UdfFieldValueResultData } from '../userDefinedFields/udfFieldValueResultData';

export class PersonnelInfoResultData {
  public UserId: string = '';
  public IdentificationNumber: string = '';
  public DepartmentId: string = '';
  public FirstName: string = '';
  public LastName: string = '';
  public EmailAddress: string = '';
  public MobilePhone: string = '';
  public GroupId: string = '';
  public GroupName: string = '';
  public StatusId: string = '';
  public Status: string = '';
  public StatusColor: string = '';
  /** What the current status means (ActionBaseTypes, see lib/base-types); -1 when it has none, undefined from older servers. */
  public StatusBaseType?: number | null;
  public StatusTimestamp: string = '';
  public StatusDestinationId: string = '';
  public StatusDestinationName: string = '';
  /** What StatusDestinationId names: 1 station, 2 call, 3 POI; null when the status did not record it. */
  public StatusDestinationType?: number | null;
  public StaffingId: string = '';
  public Staffing: string = '';
  public StaffingColor: string = '';
  /** What the current staffing level means (StaffingBaseTypes, see lib/base-types); -1 when it has none, undefined from older servers. */
  public StaffingBaseType?: number | null;
  public StaffingTimestamp: string = '';
  public Roles: string[] = [];
  /**
   * The uploaded icon (absolute URL) of the first role this person holds, in the department's role order, that has one;
   * the same icon as their map pin. Null when none of their roles has an icon, undefined from older servers.
   */
  public RoleIconUrl?: string | null = null;
  public UdfValues: UdfFieldValueResultData[] = [];
}
