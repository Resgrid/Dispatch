import { create } from 'zustand';

import { getNearestUnits } from '@/api/dispatch/dispatch';
import { getAllGroups } from '@/api/groups/groups';
import { getRecipients } from '@/api/messaging/messages';
import { getAllPersonnelInfos } from '@/api/personnel/personnel';
import { getUnitsInfos } from '@/api/units/units';
import { logger } from '@/lib/logging';
import { type NearestUnitBoard } from '@/models/v4/dispatch/nearestUnitBoard';

export interface DispatchSelection {
  everyone: boolean;
  users: string[];
  groups: string[];
  roles: string[];
  units: string[];
}

export interface DispatchItem {
  Id: string;
  Name: string;
  /**
   * Shown beside the name in the picker: a unit's type icon (uploaded URL, with TypeMapIcon as the built-in fallback),
   * a role's own map icon, or a person's role icon (the first role they hold, in the department's role order, with one).
   */
  TypeIconUrl?: string | null;
  /** Units only: the built-in map icon the unit's type picked. */
  TypeMapIcon?: string | null;
  /** Users and units: the current status as the department named and coloured it. */
  Status?: string | null;
  StatusColor?: string | null;
  /** What the status means (ActionBaseTypes); decides availability. Null/-1 when it has no meaning, undefined from older servers. */
  StatusBaseType?: number | null;
  /** Users only: staffing level. */
  Staffing?: string | null;
  StaffingColor?: string | null;
  StaffingBaseType?: number | null;
  /** Users: their group; units: their station. */
  GroupName?: string | null;
  /** Users only: the personnel roles they hold. */
  Roles?: string[];
  /** Units only: the unit's type name. */
  TypeName?: string | null;
  /** Units only: who is riding the unit, "Name (Seat)". */
  Crew?: string[];
  /** Groups only: boundary JSON (`[{"lat","lng"}]`) and its colour, for the dispatch map. */
  Geofence?: string | null;
  GeofenceColor?: string | null;
}

export interface DispatchData {
  users: DispatchItem[];
  groups: DispatchItem[];
  roles: DispatchItem[];
  units: DispatchItem[];
}

export interface DispatchLoadFailures {
  users: boolean;
  groups: boolean;
  roles: boolean;
  units: boolean;
}

interface DispatchState {
  data: DispatchData;
  selection: DispatchSelection;
  isLoading: boolean;
  error: string | null;
  /**
   * Which sections failed to load. Previously one failing request emptied the whole picker and the
   * dispatcher saw only "Everyone" -- indistinguishable from a department with no units or crew.
   */
  loadFailures: DispatchLoadFailures;
  searchQuery: string;
  /**
   * The nearest-unit board for the call location (distance, ETA, crew, positions), or null before a location is known.
   * Shared by the recipient picker and the New Call map so both show the same ranking.
   */
  board: NearestUnitBoard | null;
  /** The location the board was built for, `lat,lon` rounded to ~1 m. */
  boardKey: string | null;
  isBoardLoading: boolean;
  boardError: boolean;
  fetchDispatchData: (forceRefresh?: boolean) => Promise<void>;
  /** Loads the board for a call location. Reuses a board for the same spot younger than BOARD_MAX_AGE_MS unless forced. */
  fetchNearestBoard: (latitude: number, longitude: number, force?: boolean) => Promise<void>;
  clearNearestBoard: () => void;
  setSelection: (selection: DispatchSelection) => void;
  toggleEveryone: () => void;
  toggleUser: (userId: string) => void;
  toggleGroup: (groupId: string) => void;
  toggleRole: (roleId: string) => void;
  toggleUnit: (unitId: string) => void;
  setSearchQuery: (query: string) => void;
  clearSelection: () => void;
  getFilteredData: () => DispatchData;
}

/**
 * The recipients matching a search, by name. Pure so a component can memoise it on `data` and the query: memoising on
 * the store's stable `getFilteredData` action computed the list once, at mount, so a picker opened before the data
 * arrived showed only "Everyone" for the rest of the session.
 */
export const filterDispatchData = (data: DispatchData, searchQuery: string): DispatchData => {
  if (!searchQuery.trim()) {
    return data;
  }

  const query = searchQuery.toLowerCase();
  return {
    users: data.users.filter((user) => user.Name.toLowerCase().includes(query)),
    groups: data.groups.filter((group) => group.Name.toLowerCase().includes(query)),
    roles: data.roles.filter((role) => role.Name.toLowerCase().includes(query)),
    units: data.units.filter((unit) => unit.Name.toLowerCase().includes(query)),
  };
};

/** Statuses and positions move; a board older than this is fetched again when the picker or map asks for it. */
export const BOARD_MAX_AGE_MS = 30 * 1000;

export const boardKeyFor = (latitude: number, longitude: number) => `${latitude.toFixed(5)},${longitude.toFixed(5)}`;

let boardRequest: AbortController | null = null;
let boardFetchedAt = 0;

/** "Name (Seat)" for each filled seat on a unit, as the units endpoint lists them. */
const crewFor = (roles: { Name?: string | null; RoleName?: string | null; UserId?: string | null }[] | null | undefined): string[] =>
  (roles ?? [])
    .filter((role) => !!role?.UserId && !!role.Name?.trim())
    .map((role) => {
      const name = (role.Name ?? '').trim();
      const seat = (role.RoleName ?? '').trim();
      return seat ? `${name} (${seat})` : name;
    });

const initialSelection: DispatchSelection = {
  everyone: false,
  users: [],
  groups: [],
  roles: [],
  units: [],
};

export const useDispatchStore = create<DispatchState>((set, get) => ({
  data: {
    users: [],
    groups: [],
    roles: [],
    units: [],
  },
  selection: initialSelection,
  isLoading: false,
  error: null,
  loadFailures: { users: false, groups: false, roles: false, units: false },
  searchQuery: '',
  board: null,
  boardKey: null,
  isBoardLoading: false,
  boardError: false,

  fetchDispatchData: async (forceRefresh = false) => {
    set({ isLoading: true, error: null });

    // allSettled, not all: personnel, groups, roles and units are independent lists, and a dispatcher
    // who can still see units must not lose them because the personnel call failed.
    const [personnelSettled, groupsSettled, recipientsSettled, unitsSettled] = await Promise.allSettled([getAllPersonnelInfos(''), getAllGroups(), getRecipients(true, false), getUnitsInfos('', forceRefresh)]);

    const personnelResult = personnelSettled.status === 'fulfilled' ? personnelSettled.value : null;
    const groupsResult = groupsSettled.status === 'fulfilled' ? groupsSettled.value : null;
    const recipientsResult = recipientsSettled.status === 'fulfilled' ? recipientsSettled.value : null;
    const unitsResult = unitsSettled.status === 'fulfilled' ? unitsSettled.value : null;

    const loadFailures = {
      users: personnelSettled.status === 'rejected',
      groups: groupsSettled.status === 'rejected',
      roles: recipientsSettled.status === 'rejected',
      units: unitsSettled.status === 'rejected',
    };

    if (personnelSettled.status === 'rejected') {
      logger.error({ message: 'Failed to load dispatch personnel', context: { error: personnelSettled.reason } });
    }
    if (groupsSettled.status === 'rejected') {
      logger.error({ message: 'Failed to load dispatch groups', context: { error: groupsSettled.reason } });
    }
    if (recipientsSettled.status === 'rejected') {
      logger.error({ message: 'Failed to load dispatch roles', context: { error: recipientsSettled.reason } });
    }
    if (unitsSettled.status === 'rejected') {
      logger.error({ message: 'Failed to load dispatch units', context: { error: unitsSettled.reason } });
    }

    const users: DispatchItem[] = (personnelResult?.Data ?? []).map((p) => ({
      Id: p.UserId,
      Name: `${p.FirstName} ${p.LastName}`.trim(),
      TypeIconUrl: p.RoleIconUrl,
      Status: p.Status,
      StatusColor: p.StatusColor,
      StatusBaseType: p.StatusBaseType,
      Staffing: p.Staffing,
      StaffingColor: p.StaffingColor,
      StaffingBaseType: p.StaffingBaseType,
      GroupName: p.GroupName,
      Roles: p.Roles ?? [],
    }));

    const groups: DispatchItem[] = (groupsResult?.Data ?? []).map((g) => ({
      Id: g.GroupId,
      Name: g.Name,
      Geofence: g.Geofence,
      GeofenceColor: g.GeofenceColor,
    }));

    const units: DispatchItem[] = (unitsResult?.Data ?? []).map((u) => ({
      Id: u.UnitId,
      Name: u.Name,
      TypeIconUrl: u.TypeIconUrl,
      TypeMapIcon: u.TypeMapIcon,
      Status: u.CurrentStatus,
      StatusColor: u.CurrentStatusColor,
      StatusBaseType: u.CurrentStatusBaseType,
      GroupName: u.GroupName,
      TypeName: u.Type,
      Crew: crewFor(u.Roles),
    }));

    // Roles come from the recipients endpoint because it is the only one that carries the role id.
    // The personnel payload only names the roles a member holds, and dispatching by name put
    // "R:PARAMEDICO" on the wire, which the API could not resolve to a role.
    const roles: DispatchItem[] = (recipientsResult?.Data ?? [])
      .filter((recipient) => recipient?.Id && recipient.Type === 'Roles')
      .map((recipient) => ({
        Id: recipient.Id.replace(/^R:/, ''),
        Name: recipient.Name,
        TypeIconUrl: recipient.TypeIconUrl,
      }));

    set({
      data: { users, groups, roles, units },
      loadFailures,
      // Only a total failure is a modal-level error; a partial one is reported per section so the
      // dispatcher can still work with whatever loaded.
      error: loadFailures.users && loadFailures.groups && loadFailures.roles && loadFailures.units ? 'Failed to fetch dispatch data' : null,
      isLoading: false,
    });
  },

  fetchNearestBoard: async (latitude: number, longitude: number, force = false) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
      return;
    }

    const key = boardKeyFor(latitude, longitude);
    const { boardKey, board, isBoardLoading } = get();
    if (!force && key === boardKey && (isBoardLoading || (board && Date.now() - boardFetchedAt < BOARD_MAX_AGE_MS))) {
      return;
    }

    // A newer location wins: the board for a spot the dispatcher has already moved away from is thrown away.
    boardRequest?.abort();
    const controller = new AbortController();
    boardRequest = controller;
    set({ boardKey: key, isBoardLoading: true, boardError: false, ...(key === boardKey ? {} : { board: null }) });

    try {
      const result = await getNearestUnits(latitude, longitude, controller.signal);
      if (boardRequest !== controller) return;
      boardFetchedAt = Date.now();
      set({ board: result, isBoardLoading: false });
    } catch (error) {
      if (boardRequest !== controller || controller.signal.aborted) return;
      logger.error({ message: 'Failed to load the nearest unit board', context: { error } });
      set({ isBoardLoading: false, boardError: true });
    }
  },

  clearNearestBoard: () => {
    boardRequest?.abort();
    boardRequest = null;
    boardFetchedAt = 0;
    set({ board: null, boardKey: null, isBoardLoading: false, boardError: false });
  },

  setSelection: (selection: DispatchSelection) => {
    set({ selection });
  },

  toggleEveryone: () => {
    const { selection } = get();
    if (selection.everyone) {
      set({
        selection: {
          ...selection,
          everyone: false,
        },
      });
    } else {
      set({
        selection: {
          everyone: true,
          users: [],
          groups: [],
          roles: [],
          units: [],
        },
      });
    }
  },

  toggleUser: (userId: string) => {
    const { selection } = get();
    const isSelected = selection.users.includes(userId);

    set({
      selection: {
        ...selection,
        everyone: false,
        users: isSelected ? selection.users.filter((id) => id !== userId) : [...selection.users, userId],
      },
    });
  },

  toggleGroup: (groupId: string) => {
    const { selection } = get();
    const isSelected = selection.groups.includes(groupId);

    set({
      selection: {
        ...selection,
        everyone: false,
        groups: isSelected ? selection.groups.filter((id) => id !== groupId) : [...selection.groups, groupId],
      },
    });
  },

  toggleRole: (roleId: string) => {
    const { selection } = get();
    const isSelected = selection.roles.includes(roleId);

    set({
      selection: {
        ...selection,
        everyone: false,
        roles: isSelected ? selection.roles.filter((id) => id !== roleId) : [...selection.roles, roleId],
      },
    });
  },

  toggleUnit: (unitId: string) => {
    const { selection } = get();
    const isSelected = selection.units.includes(unitId);

    set({
      selection: {
        ...selection,
        everyone: false,
        units: isSelected ? selection.units.filter((id) => id !== unitId) : [...selection.units, unitId],
      },
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearSelection: () => {
    set({ selection: initialSelection });
  },

  getFilteredData: () => {
    const { data, searchQuery } = get();
    return filterDispatchData(data, searchQuery);
  },
}));
