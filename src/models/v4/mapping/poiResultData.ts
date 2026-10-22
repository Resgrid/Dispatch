export class PoiResultData {
  public PoiId: number = 0;
  public PoiTypeId: number = 0;
  public PoiTypeName: string = '';
  public Name: string = '';
  public Address: string = '';
  public Note: string = '';
  public Latitude: number = 0;
  public Longitude: number = 0;
  public Color: string = '';
  public ImagePath: string = '';
  public Marker: string = '';
  public IsDestination: boolean = false;
  /** The department's uploaded icon for the POI's type (absolute URL, anonymous GET, 128x128 PNG); null when none was uploaded or from older servers. */
  public IconUrl?: string | null = null;
  /** Names of the department capabilities the POI offers (e.g. "Cath Lab"); absent from servers before POI capabilities. */
  public Capabilities?: string[];
}
