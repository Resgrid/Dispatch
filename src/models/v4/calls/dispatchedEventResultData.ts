export class DispatchedEventResultData {
  public Id: string = '';
  public Timestamp: string = '';
  public Type: string = '';
  public Name: string = '';
  public GroupId: string = '';
  public Group: string = '';
  public Note: string = '';
  public StatusId: number = 0;
  public Location: string = '';

  public StatusText: string = '';
  public StatusColor: string = '';

  /**
   * How a status entry was tied to this call (server `StatusDestinationSources`, see `@/lib/activity-link`):
   * 1 Explicit (the sender chose the call); 2 CarryForward, 3 Dispatch, 4 Unit (auto-linked: sent without a
   * call and linked by the server from the previous status, the one open dispatch, or the unit a person rode);
   * 5 Inferred (set with no destination by a unit/person dispatched to this call while working it; derived at
   * read time). Null/absent on older rows and non-status entries.
   */
  public DestinationSource?: number | null = null;

  /** Unit rows only: the department's uploaded icon for the unit's type (absolute URL); null otherwise or from older servers. */
  public TypeIconUrl?: string | null = null;
  /** Unit rows only: the built-in map icon the unit's type picked (lowercase MAP_ICONS key); null otherwise or from older servers. */
  public TypeMapIcon?: string | null = null;

  /**
   * Unit dispatch rows only (conditional run cards): the response code the unit was sent with ("C3"), its name and badge
   * colour (hex). Null unless the department shows response codes to crews, and absent from older servers.
   */
  public ResponseCode?: string | null = null;
  public ResponseCodeName?: string | null = null;
  public ResponseCodeColor?: string | null = null;
}
