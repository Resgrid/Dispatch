export class CallTypeResultData {
  public Id: string = '';
  public Name: string = '';
  /** What kind of call the type is (CallTypeClasses, see lib/base-types); -1 when not set, undefined from older servers. */
  public BaseType?: number | null;
  /** The department's uploaded icon for the type (absolute URL, anonymous GET, 128x128 PNG); null when none was uploaded or from older servers. */
  public IconUrl?: string | null = null;
  /** The built-in map icon the type picked (lowercase MAP_ICONS key, e.g. "fire"); null when none or from older servers. */
  public MapIcon?: string | null = null;
}
