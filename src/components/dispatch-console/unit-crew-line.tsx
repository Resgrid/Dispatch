import { Users } from 'lucide-react-native';
import React, { useMemo } from 'react';

import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getUnitCrew } from '@/lib/unit-crew';
import { type UnitInfoResultData } from '@/models/v4/units/unitInfoResultData';

/**
 * How many of a unit's role seats are filled ("3/4") followed by the people on them. Renders nothing for a unit that
 * defines no roles. The count is green when every seat is filled, amber when some are, grey when none are.
 */
export const UnitCrewLine: React.FC<{ unit: Pick<UnitInfoResultData, 'UnitId' | 'Roles'> | undefined }> = React.memo(({ unit }) => {
  const crew = useMemo(() => getUnitCrew(unit), [unit]);

  if (!unit || crew.total === 0) {
    return null;
  }

  const countClass = crew.filled === crew.total ? 'text-green-600 dark:text-green-400' : crew.filled > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400';

  return (
    <HStack className="mt-0.5 items-center" space="xs" testID={`unit-crew-${unit.UnitId}`}>
      <Icon as={Users} size="xs" className="text-gray-400" />
      <Text className={`text-xs font-semibold ${countClass}`} testID={`unit-crew-count-${unit.UnitId}`}>{`${crew.filled}/${crew.total}`}</Text>
      {crew.names.length > 0 ? (
        <Text className="flex-1 text-xs text-gray-600 dark:text-gray-300" numberOfLines={2} testID={`unit-crew-names-${unit.UnitId}`}>
          {crew.names.join(', ')}
        </Text>
      ) : null}
    </HStack>
  );
});

UnitCrewLine.displayName = 'UnitCrewLine';
