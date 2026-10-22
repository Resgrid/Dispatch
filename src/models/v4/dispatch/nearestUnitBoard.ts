/** How an ETA was produced (server EtaSources). */
export enum EtaSource {
  None = 0,
  /** Straight-line distance at an assumed road speed; shown as an estimate. */
  Estimated = 1,
  /** Routed drive time from the mapping provider. */
  Road = 2,
}

/** Where a unit's position on the board comes from (server UnitPositionSources). */
export enum UnitPositionSource {
  None = 0,
  /** The unit's latest GPS fix. */
  Live = 1,
  /** The unit's station: its status says it is in quarters, or it has no GPS fix. */
  Station = 2,
}

/** One unit on the nearest-unit board (`/Dispatch/GetNearestUnits`). */
export interface NearestUnitResult {
  UnitId: number;
  Name: string;
  UnitType?: string | null;
  DepartmentGroupId?: number | null;
  GroupName?: string | null;
  StatusText?: string | null;
  /** The status's colour as the department set it up (hex); null when it has none. */
  StatusColor?: string | null;
  StatusTextColor?: string | null;
  IsAvailable: boolean;
  /** Null when the unit has no position, or the viewer may not see it (LocationHidden). */
  Latitude?: number | null;
  Longitude?: number | null;
  PositionTimestamp?: string | null;
  PositionIsStale: boolean;
  PositionSource: UnitPositionSource;
  /** The viewer may not see this unit's location; distance and ETA are still given. */
  LocationHidden: boolean;
  DistanceMeters?: number | null;
  /** Travel time only. */
  EtaSeconds?: number | null;
  EtaSource: EtaSource;
  TurnoutSeconds: number;
  /** Turnout plus travel: what the board ranks on. */
  ResponseSeconds?: number | null;
  /** Crew names, as far as the viewer may see them. */
  Crew: string[];
  CrewCount: number;
  CrewAvailableCount: number;
  OnShiftCount: number;
}

/** One responder on the nearest-unit board. */
export interface NearestPersonnelResult {
  UserId: string;
  Name: string;
  DepartmentGroupId?: number | null;
  GroupName?: string | null;
  /** The unit the person is assigned to right now. */
  UnitId?: number | null;
  UnitName?: string | null;
  StatusText?: string | null;
  /** Hex; null when the status has none or the server predates it. */
  StatusColor?: string | null;
  StaffingText?: string | null;
  StaffingColor?: string | null;
  IsAvailable: boolean;
  IsOnShift: boolean;
  Roles: string[];
  Latitude?: number | null;
  Longitude?: number | null;
  LocationTimestamp?: string | null;
  LocationIsStale: boolean;
  LocationHidden: boolean;
  DistanceMeters?: number | null;
  EtaSeconds?: number | null;
  EtaSource: EtaSource;
}

/**
 * Every unit and responder the viewer may dispatch, ranked for an incident location: available first, then response time
 * (turnout + travel), then distance. Hidden positions keep their distance and ETA but carry no coordinates.
 */
export interface NearestUnitBoard {
  Latitude: number;
  Longitude: number;
  GeneratedOn: string;
  IsDepartmentWide: boolean;
  Units: NearestUnitResult[];
  Personnel: NearestPersonnelResult[];
  Notes: string[];
}

export interface GetNearestUnitsResult {
  Data: NearestUnitBoard | null;
  Status?: string;
}
