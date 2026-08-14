import { create } from 'zustand';

import { getAllGroups } from '@/api/groups/groups';
import { getAllPersonnelInfos } from '@/api/personnel/personnel';
import { getUnits } from '@/api/units/units';
import { logger } from '@/lib/logging';

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
  fetchDispatchData: (forceRefresh?: boolean) => Promise<void>;
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
  loadFailures: { users: false, groups: false, units: false },
  searchQuery: '',

  fetchDispatchData: async (forceRefresh = false) => {
    set({ isLoading: true, error: null });

    // allSettled, not all: personnel, groups and units are independent lists, and a dispatcher who
    // can still see units must not lose them because the personnel call failed.
    const [personnelSettled, groupsSettled, unitsSettled] = await Promise.allSettled([getAllPersonnelInfos(''), getAllGroups(), getUnits(forceRefresh)]);

    const personnelResult = personnelSettled.status === 'fulfilled' ? personnelSettled.value : null;
    const groupsResult = groupsSettled.status === 'fulfilled' ? groupsSettled.value : null;
    const unitsResult = unitsSettled.status === 'fulfilled' ? unitsSettled.value : null;

    const loadFailures = {
      users: personnelSettled.status === 'rejected',
      groups: groupsSettled.status === 'rejected',
      units: unitsSettled.status === 'rejected',
    };

    if (personnelSettled.status === 'rejected') {
      logger.error({ message: 'Failed to load dispatch personnel', context: { error: personnelSettled.reason } });
    }
    if (groupsSettled.status === 'rejected') {
      logger.error({ message: 'Failed to load dispatch groups', context: { error: groupsSettled.reason } });
    }
    if (unitsSettled.status === 'rejected') {
      logger.error({ message: 'Failed to load dispatch units', context: { error: unitsSettled.reason } });
    }

    const users: DispatchItem[] = (personnelResult?.Data ?? []).map((p) => ({
      Id: p.UserId,
      Name: `${p.FirstName} ${p.LastName}`.trim(),
    }));

    const groups: DispatchItem[] = (groupsResult?.Data ?? []).map((g) => ({
      Id: g.GroupId,
      Name: g.Name,
    }));

    const units: DispatchItem[] = (unitsResult?.Data ?? []).map((u) => ({
      Id: u.UnitId,
      Name: u.Name,
    }));

    // Extract unique roles from personnel data
    const roleSet = new Map<string, string>();
    (personnelResult?.Data ?? []).forEach((p) => {
      if (p.Roles) {
        p.Roles.forEach((role) => {
          if (role && !roleSet.has(role)) {
            roleSet.set(role, role);
          }
        });
      }
    });
    const roles: DispatchItem[] = Array.from(roleSet.entries()).map(([name]) => ({
      Id: name,
      Name: name,
    }));

    set({
      data: { users, groups, roles, units },
      loadFailures,
      // Only a total failure is a modal-level error; a partial one is reported per section so the
      // dispatcher can still work with whatever loaded.
      error: loadFailures.users && loadFailures.groups && loadFailures.units ? 'Failed to fetch dispatch data' : null,
      isLoading: false,
    });
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
  },
}));
