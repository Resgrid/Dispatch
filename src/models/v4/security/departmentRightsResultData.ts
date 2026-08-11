export class DepartmentRightsResultData {
  public DepartmentName: string = '';
  public DepartmentCode: string = '';
  public FullName: string = '';
  public EmailAddress: string = '';
  public DepartmentId: string = '';
  public IsAdmin: boolean = false; // Is Department Admin
  public CanViewPII: boolean = false; // Can View PII
  public CanCreateCalls: boolean = false; // Can Create Calls
  public CanAddNote: boolean = false; // Can Add a Note
  public CanCreateMessage: boolean = false; // Can Add a Message
  /**
   * Whether this user may use the Dispatch app at all. Dispatch surfaces private command, unit and
   * responder traffic, so departments can restrict it; defaults to true for everyone when the
   * permission has never been configured.
   */
  public CanLoginToDispatchApp: boolean = true;
  /**
   * Whether this user may work incident command: read command boards and act on them. A dispatcher
   * assisting an incident needs this in addition to Dispatch access. Defaults to true for everyone
   * when the department has never configured the permission.
   */
  public CanLoginToCommandApp: boolean = true;
  public Groups: GroupRightResultData[] = []; // Group Rights
}

export class GroupRightResultData {
  public GroupId: number = 0; // Group Id
  public IsGroupAdmin: boolean = false; // Is Group Admin
}
