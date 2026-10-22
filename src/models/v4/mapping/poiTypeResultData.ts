export class PoiTypeResultData {
  public PoiTypeId: number = 0;
  public Name: string = '';
  public Color: string = '';
  public ImagePath: string = '';
  public Marker: string = '';
  public IsDestination: boolean = false;
  /** The department's uploaded icon for the POI type (absolute URL, anonymous GET, 128x128 PNG); null when none was uploaded or from older servers. */
  public IconUrl?: string | null = null;
}
