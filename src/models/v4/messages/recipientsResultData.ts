export class RecipientsResultData {
  public Id: string = '';
  public Type: string = '';
  public Name: string = '';
  public Selected: boolean = false;
  /** Type "Unit" rows: the department's uploaded icon for the unit's type; type "Roles" rows: the role's uploaded map icon (absolute URLs). Null otherwise or from older servers. */
  public TypeIconUrl?: string | null = null;
  /** Type "Unit" rows only: the built-in map icon the unit's type picked (lowercase MAP_ICONS key); null otherwise or from older servers. */
  public TypeMapIcon?: string | null = null;
}
