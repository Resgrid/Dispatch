import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { Badge, BadgeText } from '@/components/ui/badge';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type ActivityLinkKind, getActivityLinkKind, getActivityLinkKinds } from '@/lib/activity-link';
import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';

const MARKER_TEXT: Record<ActivityLinkKind, { label: string; hint: string; action: 'info' | 'warning' }> = {
  auto: { label: 'call_detail.activity_link.auto_linked', hint: 'call_detail.activity_link.auto_linked_hint', action: 'info' },
  inferred: { label: 'call_detail.activity_link.inferred', hint: 'call_detail.activity_link.inferred_hint', action: 'warning' },
};

const MarkerBadge: React.FC<{ kind: ActivityLinkKind; decorative?: boolean }> = ({ kind, decorative = false }) => {
  const { t } = useTranslation();
  const { label, hint, action } = MARKER_TEXT[kind];
  const labelText = t(label);
  const hintText = t(hint);

  if (decorative) {
    return (
      <Badge size="sm" variant="outline" action={action} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <BadgeText>{labelText}</BadgeText>
      </Badge>
    );
  }

  return (
    <Badge
      size="sm"
      variant="outline"
      action={action}
      testID={`activity-link-marker-${kind}`}
      accessible
      // react-native-web drops accessibilityHint, so on web the explanation rides in the label itself.
      accessibilityLabel={Platform.OS === 'web' ? `${labelText}: ${hintText}` : labelText}
      accessibilityHint={hintText}
    >
      <BadgeText>{labelText}</BadgeText>
    </Badge>
  );
};

/**
 * Marks a call-activity status entry the server linked on the sender's behalf ("auto-linked") or attributed to
 * the call at read time ("inferred"). Renders nothing for explicit entries, older rows and non-status entries.
 */
export const ActivityLinkMarker: React.FC<{ source?: number | null }> = React.memo(({ source }) => {
  const kind = getActivityLinkKind(source);
  return kind ? <MarkerBadge kind={kind} /> : null;
});

ActivityLinkMarker.displayName = 'ActivityLinkMarker';

/** One line per marker kind present in the list, explaining it; renders nothing when no entry is marked. */
export const ActivityLinkLegend: React.FC<{ activity?: DispatchedEventResultData[] | null }> = React.memo(({ activity }) => {
  const { t } = useTranslation();
  const kinds = React.useMemo(() => getActivityLinkKinds(activity), [activity]);
  if (kinds.length === 0) return null;

  return (
    <VStack className="mt-2 border-t border-gray-100 pt-2 dark:border-gray-800" space="xs" testID="activity-link-legend">
      {kinds.map((kind) => {
        const labelText = t(MARKER_TEXT[kind].label);
        const hintText = t(MARKER_TEXT[kind].hint);
        return (
          <HStack key={kind} className="items-center" space="xs" accessible accessibilityLabel={`${labelText}: ${hintText}`}>
            <MarkerBadge kind={kind} decorative />
            <Text className="flex-1 text-xs text-gray-500 dark:text-gray-400">{hintText}</Text>
          </HStack>
        );
      })}
    </VStack>
  );
});

ActivityLinkLegend.displayName = 'ActivityLinkLegend';
