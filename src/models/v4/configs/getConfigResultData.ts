export class GetConfigResultData {
  public W3WKey: string = '';
  public GoogleMapsKey: string = '';
  public EventingUrl: string = '';
  public LoggingKey: string = '';
  public MapUrl: string = '';
  public MapAttribution: string = '';
  public OpenWeatherApiKey: string = '';
  public DirectionsMapKey: string = '';
  public PersonnelLocationStaleSeconds: number = 300;
  public UnitLocationStaleSeconds: number = 300;
  public PersonnelLocationMinMeters: number = 15;
  public UnitLocationMinMeters: number = 15;
  public NovuBackendApiUrl: string = '';
  public NovuSocketUrl: string = '';
  public NovuApplicationId: string = '';
  public AnalyticsApiKey: string = '';
  public AnalyticsHost: string = '';
  /** Department default map center latitude — every map opens here when it has nothing better. */
  public MapCenterLatitude: number = 0;
  /** Department default map center longitude. */
  public MapCenterLongitude: number = 0;
  /** Zoom level for department-wide maps. */
  public MapCenterZoomLevel: number = 9;
  /** Department base map style (mapbox:// url) for the light theme. */
  public MapDayStyleUrl: string = '';
  /** Department base map style (mapbox:// url) for the dark theme. */
  public MapNightStyleUrl: string = '';
  /** Server-supplied public Mapbox token for this app ('' = keep the built-in token). */
  public AppMapboxAccessToken: string = '';
  /** True when the department's own Mapbox account (token and custom style) is in effect; its style then waits for that token. */
  public IsDepartmentMapOverride: boolean = false;
}
