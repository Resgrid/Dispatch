import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';

import { TypeIcon } from '@/components/common/type-icon';
import { Box } from '@/components/ui/box';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { CheckIcon } from '@/components/ui/lucide-icons';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { UnitTypeIcon } from '@/components/units/unit-type-icon';
import { useReadableColor } from '@/hooks/use-readable-color';
import { type BoardRank, formatDistanceEta, positionNote } from '@/lib/dispatch-board';
import { type NearestPersonnelResult, type NearestUnitResult } from '@/models/v4/dispatch/nearestUnitBoard';
import { type DispatchItem } from '@/stores/dispatch/store';

/*
 * Picker rows with what a dispatcher needs to choose: status, staffing, group, roles and crew, and, once the call has a
 * location, distance, ETA and a "Nearest" badge from the nearest-unit board. Department colours go through
 * useReadableColor so a dark status colour stays readable on the dark theme and a pale one on the light theme.
 */

const Checkbox: React.FC<{ checked: boolean }> = ({ checked }) => (
  <Box className={`size-5 items-center justify-center rounded border-2 ${checked ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
    {checked ? <CheckIcon size={12} color="#ffffff" /> : null}
  </Box>
);

/** A coloured dot and the label in a readable version of the same colour. */
const StatusChip: React.FC<{ label?: string | null; color?: string | null; testID?: string }> = ({ label, color, testID }) => {
  const readable = useReadableColor();
  if (!label) return null;

  return (
    <HStack className="items-center gap-1" testID={testID}>
      <Box style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: readable.mark(color) }} />
      <Text className="text-xs font-medium" style={{ color: readable.text(color) }} numberOfLines={1}>
        {label}
      </Text>
    </HStack>
  );
};

const NearestBadge: React.FC<{ rank: number | null | undefined; testID?: string }> = ({ rank, testID }) => {
  const { t } = useTranslation();
  if (!rank) return null;

  return (
    <Box className="rounded-full bg-emerald-100 px-2 py-0.5 dark:bg-emerald-900" testID={testID}>
      <Text className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">{t('calls.dispatch_board.nearest', { rank })}</Text>
    </Box>
  );
};

/** The run card proposes this resource for the call (New Call's recommendation, or what an existing call still needs). */
const RunCardBadge: React.FC<{ show?: boolean; testID?: string }> = ({ show, testID }) => {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <Box className="rounded-full bg-indigo-100 px-2 py-0.5 dark:bg-indigo-900" testID={testID}>
      <Text className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">{t('calls.dispatch_board.run_card_pick')}</Text>
    </Box>
  );
};

const DistanceText: React.FC<{ text: string | null; testID?: string }> = ({ text, testID }) =>
  text ? (
    <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100" testID={testID}>
      {text}
    </Text>
  ) : null;

const PositionNote: React.FC<{ note: ReturnType<typeof positionNote>; testID?: string }> = ({ note, testID }) => {
  const { t } = useTranslation();
  if (!note) return null;

  return (
    <Text className="text-xs text-amber-700 dark:text-amber-300" testID={testID}>
      {t(note.key, note.values)}
    </Text>
  );
};

const rowClass = (selected: boolean, unavailable: boolean) =>
  `mb-2 rounded-lg border p-3 ${selected ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-gray-800' : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'}${unavailable ? ' opacity-70' : ''}`;

interface UserRowProps {
  user: DispatchItem;
  rank?: BoardRank<NearestPersonnelResult>;
  selected: boolean;
  available: boolean;
  /** Only the first few available entries with a distance get the badge. */
  showNearest: boolean;
  /** The run card recommends this person. */
  recommended?: boolean;
  onToggle: (id: string) => void;
}

export const DispatchUserRow: React.FC<UserRowProps> = ({ user, rank, selected, available, showNearest, recommended, onToggle }) => {
  const { t } = useTranslation();
  const entry = rank?.entry;
  const status = entry?.StatusText || user.Status;
  const statusColor = entry?.StatusColor || user.StatusColor;
  const staffing = entry?.StaffingText || user.Staffing;
  const staffingColor = entry?.StaffingColor || user.StaffingColor;
  const roles = (entry?.Roles?.length ? entry.Roles : user.Roles) ?? [];
  const group = entry?.GroupName || user.GroupName;
  const details = [group, roles.join(', '), entry?.UnitName ? t('calls.dispatch_board.on_unit', { unit: entry.UnitName }) : null].filter(Boolean).join(' · ');

  return (
    <Card className={rowClass(selected, !available)} testID={`dispatch-user-row-${user.Id}`}>
      <TouchableOpacity onPress={() => onToggle(user.Id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
        <HStack className="items-start gap-3">
          <Box className="pt-0.5">
            <Checkbox checked={selected} />
          </Box>
          <VStack className="flex-1 gap-1">
            <HStack className="items-center justify-between gap-2">
              <HStack className="flex-1 items-center gap-2">
                <TypeIcon iconUrl={user.TypeIconUrl} size={20} testID={`dispatch-user-icon-${user.Id}`} />
                <Text className="flex-shrink font-medium" numberOfLines={1}>
                  {user.Name}
                </Text>
                {showNearest ? <NearestBadge rank={rank?.nearestRank} testID={`dispatch-user-nearest-${user.Id}`} /> : null}
                <RunCardBadge show={recommended} testID={`dispatch-user-runcard-${user.Id}`} />
              </HStack>
              <DistanceText text={entry ? formatDistanceEta(entry.DistanceMeters, entry.EtaSeconds, entry.EtaSource) : null} testID={`dispatch-user-distance-${user.Id}`} />
            </HStack>
            <HStack className="flex-wrap items-center gap-x-3 gap-y-1">
              <StatusChip label={status} color={statusColor} testID={`dispatch-user-status-${user.Id}`} />
              <StatusChip label={staffing} color={staffingColor} testID={`dispatch-user-staffing-${user.Id}`} />
            </HStack>
            {details ? (
              <Text className="text-xs text-gray-600 dark:text-gray-400" numberOfLines={2} testID={`dispatch-user-details-${user.Id}`}>
                {details}
              </Text>
            ) : null}
            {entry ? <PositionNote note={positionNote(entry)} testID={`dispatch-user-position-${user.Id}`} /> : null}
          </VStack>
        </HStack>
      </TouchableOpacity>
    </Card>
  );
};

interface UnitRowProps {
  unit: DispatchItem;
  rank?: BoardRank<NearestUnitResult>;
  selected: boolean;
  available: boolean;
  showNearest: boolean;
  /** The run card recommends this unit. */
  recommended?: boolean;
  onToggle: (id: string) => void;
}

export const DispatchUnitRow: React.FC<UnitRowProps> = ({ unit, rank, selected, available, showNearest, recommended, onToggle }) => {
  const { t } = useTranslation();
  const entry = rank?.entry;
  const status = entry?.StatusText || unit.Status;
  const statusColor = entry?.StatusColor || unit.StatusColor;
  const kind = [entry?.UnitType || unit.TypeName, entry?.GroupName || unit.GroupName].filter(Boolean).join(' · ');
  // The units endpoint names the seat each person fills; the board falls back to who is on shift at the station.
  const crew = unit.Crew?.length ? unit.Crew : (entry?.Crew ?? []);

  return (
    <Card className={rowClass(selected, !available)} testID={`dispatch-unit-row-${unit.Id}`}>
      <TouchableOpacity onPress={() => onToggle(unit.Id)} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}>
        <HStack className="items-start gap-3">
          <Box className="pt-0.5">
            <Checkbox checked={selected} />
          </Box>
          <VStack className="flex-1 gap-1">
            <HStack className="items-center justify-between gap-2">
              <HStack className="flex-1 items-center gap-2">
                <UnitTypeIcon iconUrl={unit.TypeIconUrl} mapIcon={unit.TypeMapIcon} size={20} />
                <Text className="flex-shrink font-medium" numberOfLines={1}>
                  {unit.Name}
                </Text>
                {showNearest ? <NearestBadge rank={rank?.nearestRank} testID={`dispatch-unit-nearest-${unit.Id}`} /> : null}
                <RunCardBadge show={recommended} testID={`dispatch-unit-runcard-${unit.Id}`} />
              </HStack>
              <DistanceText text={entry ? formatDistanceEta(entry.DistanceMeters, entry.EtaSeconds, entry.EtaSource) : null} testID={`dispatch-unit-distance-${unit.Id}`} />
            </HStack>
            <HStack className="flex-wrap items-center gap-x-3 gap-y-1">
              <StatusChip label={status} color={statusColor} testID={`dispatch-unit-status-${unit.Id}`} />
              {kind ? (
                <Text className="text-xs text-gray-600 dark:text-gray-400" numberOfLines={1}>
                  {kind}
                </Text>
              ) : null}
            </HStack>
            <Text className="text-xs text-gray-600 dark:text-gray-400" numberOfLines={2} testID={`dispatch-unit-crew-${unit.Id}`}>
              {crew.length ? t('calls.dispatch_board.crew', { names: crew.join(', ') }) : t('calls.dispatch_board.no_crew')}
            </Text>
            {entry ? <PositionNote note={positionNote(entry)} testID={`dispatch-unit-position-${unit.Id}`} /> : null}
          </VStack>
        </HStack>
      </TouchableOpacity>
    </Card>
  );
};
