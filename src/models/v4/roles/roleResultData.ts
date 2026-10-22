export class RoleResultData {
  public RoleId: string = '';
  public Name: string = '';
  /** The department's uploaded icon for the role (absolute URL, anonymous GET); null when none was uploaded or from older servers. */
  public IconUrl?: string | null = null;
  /** The role's position in the department's role order (lower first); undefined from older servers. */
  public SortOrder?: number;
}
