export class GroupResultData {
  public GroupId: string = '';
  public TypeId: number = 0;
  public Name: string = '';
  public Address: string = '';

  public GroupType: string = '';

  /** The station's coordinates, when the department stored them. */
  public Latitude?: string | null = null;
  public Longitude?: string | null = null;
  /** The group's boundary as JSON `[{"lat":..,"lng":..}, ...]`; empty when it has none. */
  public Geofence?: string | null = null;
  /** The boundary's colour (hex) as the department set it up. */
  public GeofenceColor?: string | null = null;
}
