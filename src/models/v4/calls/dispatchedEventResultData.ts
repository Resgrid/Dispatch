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
}
