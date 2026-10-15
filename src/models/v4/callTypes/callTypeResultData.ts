export class CallTypeResultData {
  public Id: string = '';
  public Name: string = '';
  /** What kind of call the type is (CallTypeClasses, see lib/base-types); -1 when not set, undefined from older servers. */
  public BaseType?: number | null;
}
