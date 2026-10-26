import { type PoiLayerData } from './poiLayerData';

export class MapDataAndMarkersData {
  public CenterLat: string = '';
  public CenterLon: string = '';
  public ZoomLevel: string = '';
  public MapMakerInfos: MapMakerInfoData[] = [];
  public PoiLayers: PoiLayerData[] = [];
}

export class MapMakerInfoData {
  public Id: string = '';
  public Longitude: number = 0;
  public Latitude: number = 0;
  public Title: string = '';
  public zIndex: number = 0;
  public ImagePath: string = '';
  public InfoWindowContent: string = '';
  public Color: string = '';
  public Type: number = 0;
  public PoiImage: string = '';
  public Marker: string = '';
  public PoiTypeId: number | null = null;
  public PoiTypeName: string = '';
  public Address: string = '';
  public Note: string = '';
  public LayerId: string = '';
  public LayerName: string = '';
  /**
   * The department's uploaded icon for the pin (absolute URL): the unit type for unit pins (Type 1), the call type for
   * call pins (Type 0), the POI type for POI pins (Type 4), and for personnel pins (Type 3) the icon of the first role the
   * person holds, in the department's role order, that has one. Wins over the bundled icon / POI shape when present; null
   * otherwise or from older servers.
   */
  public IconUrl?: string | null = null;
  /**
   * The built-in pin recoloured to the call's priority or the unit's / person's status (absolute URL of a 32x37 PNG with
   * the same shape, size and bottom-tip anchor as the bundled pins). Drawn where and how the bundled `ImagePath` pin is
   * drawn when there is no `IconUrl`; null when the priority/status has no meaning, for stations, POIs and hydrants, and
   * from older servers.
   */
  public PinIconUrl?: string | null = null;
  /**
   * The style key `PinIconUrl` was drawn in: a status (`available`, `dispatched`, `responding`, `onscene`, `transporting`,
   * `returning`, `staging`, `delayed`, `unavailable`) or a priority (`low`, `medium`, `high`, `emergency`). Null as above.
   */
  public IconStyle?: string | null = null;
}
