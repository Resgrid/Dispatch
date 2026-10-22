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
}
