import { AlertTriangle, Clock, MapPin, ShieldCheck } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { TypeIcon } from '@/components/common/type-icon';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { getTimeAgoUtc, invertColor, stripHtmlTags } from '@/lib/utils';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import type { CallResultData } from '@/models/v4/calls/callResultData';

function getColor(call: CallResultData, priority: CallPriorityResultData | undefined) {
  if (!call) {
    return '#808080';
  } else if (call.CallId === '0') {
    return '#808080';
  } else if (priority && priority.Color) {
    return priority.Color;
  }

  return '#808080';
}

interface CallCardProps {
  call: CallResultData;
  priority: CallPriorityResultData | undefined;
}

export const CallCard: React.FC<CallCardProps> = React.memo(({ call, priority }) => {
  const bgColor = getColor(call, priority);
  const textColor = invertColor(bgColor, true);

  // Strip HTML tags from nature for plain text display
  const natureText = useMemo(() => {
    if (!call.Nature) return '';
    return stripHtmlTags(call.Nature).trim();
  }, [call.Nature]);

  const destinationText = useMemo(() => {
    if (!call.DestinationName) {
      return '';
    }

    return call.DestinationTypeName ? `${call.DestinationTypeName}: ${call.DestinationName}` : call.DestinationName;
  }, [call.DestinationName, call.DestinationTypeName]);

  return (
    <Box style={[styles.card, { backgroundColor: bgColor }]}>
      {/* Header Row: Call Number, Name, and Time */}
      <HStack style={styles.headerRow}>
        <HStack style={styles.titleGroup}>
          <TypeIcon iconUrl={call.TypeIconUrl} mapIcon={call.TypeMapIcon} size={20} style={styles.typeIcon} fallback={<AlertTriangle size={14} color={textColor} />} />
          <Text style={[styles.callNumber, { color: textColor }]}>#{call.Number}</Text>
          <Text style={[styles.callName, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
            {call.Name}
          </Text>
        </HStack>
        <HStack style={styles.timeGroup}>
          {call.CheckInTimersEnabled && <ShieldCheck size={12} color={textColor} style={styles.clockIcon} />}
          <Clock size={10} color={textColor} style={styles.clockIcon} />
          <Text style={[styles.timeText, { color: textColor }]}>{getTimeAgoUtc(call.LoggedOnUtc)}</Text>
        </HStack>
      </HStack>

      {/* Address Row */}
      {call.Address ? (
        <HStack style={styles.addressRow}>
          <MapPin size={12} color={textColor} style={styles.mapIcon} />
          <Text style={[styles.addressText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
            {call.Address}
          </Text>
        </HStack>
      ) : null}

      {destinationText ? (
        <HStack style={styles.destinationRow}>
          <MapPin size={12} color={textColor} style={styles.mapIcon} />
          <Text style={[styles.destinationText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
            {destinationText}
          </Text>
        </HStack>
      ) : null}

      {/* Nature Preview - compact single line */}
      {natureText ? (
        <View style={styles.natureContainer}>
          <Text style={[styles.natureText, { color: textColor }]} numberOfLines={1} ellipsizeMode="tail">
            {natureText}
          </Text>
        </View>
      ) : null}
    </Box>
  );
});

CallCard.displayName = 'CallCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    marginRight: 8,
  },
  // A light tile behind the call type icon so it reads on any priority color
  typeIcon: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
  },
  callNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  callName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  timeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clockIcon: {
    marginRight: 3,
    opacity: 0.8,
  },
  timeText: {
    fontSize: 11,
    opacity: 0.9,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  mapIcon: {
    marginRight: 4,
    opacity: 0.8,
  },
  addressText: {
    fontSize: 11,
    flex: 1,
    opacity: 0.9,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  destinationText: {
    fontSize: 11,
    flex: 1,
    opacity: 0.9,
    fontWeight: '600',
  },
  natureContainer: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  natureText: {
    fontSize: 11,
    fontStyle: 'italic',
    opacity: 0.85,
  },
});
