import { type Href, router } from 'expo-router';
import { BellRingIcon, ExternalLinkIcon, SendIcon, XIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, Text as RNText, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { awaitingCallLabel, formatResponseSeconds } from '@/lib/run-card-conditions';
import { type AwaitingUnitAlert, useAwaitingResourcesStore } from '@/stores/awaiting-resources/store';
import { useIsRunCardConditionsEnabled } from '@/stores/feature-flags/store';
import { useSecurityStore } from '@/stores/security/store';

/** Wider screens get a card in the corner; phones get it full width. */
const WIDE_LAYOUT_MIN_WIDTH = 768;
const CARD_MAX_WIDTH = 440;

const UnitAvailableAlertCard: React.FC<{ alert: AwaitingUnitAlert; isDark: boolean; canDispatch: boolean }> = ({ alert, isDark, canDispatch }) => {
  const { t } = useTranslation();
  const busyKey = useAwaitingResourcesStore((state) => state.busyKey);
  const dispatchUnit = useAwaitingResourcesStore((state) => state.dispatchUnit);
  const dismissUnitAlert = useAwaitingResourcesStore((state) => state.dismissUnitAlert);
  const theme = isDark ? darkTheme : lightTheme;
  const unitLabel = alert.unitTypeName ? `${alert.unitName ?? ''} (${alert.unitTypeName})` : (alert.unitName ?? '');

  return (
    <View style={[styles.card, theme.card]} accessibilityRole="alert" accessibilityLiveRegion="assertive" testID={`unit-available-alert-${alert.unitId}`}>
      <View style={styles.header}>
        <BellRingIcon size={18} color={theme.accent} />
        <RNText style={[styles.title, { color: theme.title }]} numberOfLines={2}>
          {t('awaiting_resources.unit_available_title', { unit: unitLabel })}
        </RNText>
        <Pressable onPress={() => dismissUnitAlert(alert.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.close')} testID={`unit-available-alert-${alert.unitId}-close`}>
          <XIcon size={18} color={theme.muted} />
        </Pressable>
      </View>
      {alert.message ? <RNText style={[styles.message, { color: theme.body }]}>{alert.message}</RNText> : null}
      {alert.calls.map((call) => {
        const callLabel = awaitingCallLabel({ CallId: call.callId, CallNumber: call.callNumber });
        const response = formatResponseSeconds(call.responseSeconds);
        const details = [call.label, response ? t('awaiting_resources.response_time', { time: response }) : null, t('awaiting_resources.waiting_minutes', { minutes: call.ageMinutes })].filter(
          (part): part is string => !!part
        );
        const isBusy = busyKey === `dispatch:${call.callId}:${alert.unitId}`;

        return (
          <View key={`alert-${alert.unitId}-call-${call.callId}`} style={[styles.callRow, { borderTopColor: theme.divider }]}>
            <RNText style={[styles.callName, { color: theme.title }]} numberOfLines={1}>
              {call.callName ? `${callLabel} · ${call.callName}` : callLabel}
            </RNText>
            <RNText style={[styles.callDetails, { color: theme.muted }]} numberOfLines={2}>
              {details.join(' · ')}
            </RNText>
            <View style={styles.actions}>
              {canDispatch ? (
                <Pressable
                  onPress={() => void dispatchUnit(call.callId, alert.unitId)}
                  disabled={isBusy}
                  style={[styles.button, { backgroundColor: theme.primary }]}
                  accessibilityRole="button"
                  testID={`unit-available-alert-${alert.unitId}-dispatch-${call.callId}`}
                >
                  {isBusy ? <ActivityIndicator size="small" color="#ffffff" /> : <SendIcon size={14} color="#ffffff" />}
                  <RNText style={styles.buttonText}>{t('awaiting_resources.dispatch_to_call', { call: callLabel })}</RNText>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => router.push(`/call/${call.callId}` as Href)}
                style={[styles.button, styles.buttonOutline, { borderColor: theme.primary }]}
                accessibilityRole="link"
                testID={`unit-available-alert-${alert.unitId}-open-${call.callId}`}
              >
                <ExternalLinkIcon size={14} color={theme.primary} />
                <RNText style={[styles.buttonText, { color: theme.primary }]}>{t('awaiting_resources.open_call')}</RNText>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
};

/**
 * Alerts that a unit matching calls awaiting resources has become available (conditional run cards). Unlike a toast,
 * each one stays on screen until the dispatcher dispatches the unit, closes it, or the calls it names stop waiting: a
 * crew short on scene must not be missed because a toast timed out. Dispatching is one step (the unit is added to the
 * call and only it is notified). Rendered once, over every screen of the signed-in shell.
 */
export const UnitAvailableAlertHost: React.FC = () => {
  const isEnabled = useIsRunCardConditionsEnabled();
  const alerts = useAwaitingResourcesStore((state) => state.unitAlerts);
  const { canUserCreateCalls } = useSecurityStore();
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  if (!isEnabled || alerts.length === 0) {
    return null;
  }

  const isWide = width >= WIDE_LAYOUT_MIN_WIDTH;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + 16 }, isWide ? { right: 16, width: Math.min(CARD_MAX_WIDTH, width - 32) } : { left: 12, right: 12 }]} testID="unit-available-alert-host">
      {alerts.map((alert) => (
        <UnitAvailableAlertCard key={alert.id} alert={alert} isDark={colorScheme === 'dark'} canDispatch={!!canUserCreateCalls} />
      ))}
    </View>
  );
};

const lightTheme = {
  card: { backgroundColor: '#fff7ed', borderColor: '#fb923c' },
  accent: '#ea580c',
  title: '#111827',
  body: '#374151',
  muted: '#6b7280',
  divider: '#fed7aa',
  primary: '#2563eb',
};

const darkTheme = {
  card: { backgroundColor: '#1c1917', borderColor: '#c2410c' },
  accent: '#fb923c',
  title: '#f9fafb',
  body: '#e5e7eb',
  muted: '#9ca3af',
  divider: '#7c2d12',
  primary: '#60a5fa',
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    zIndex: 60,
    gap: 8,
  },
  card: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    marginTop: 6,
    fontSize: 13,
  },
  callRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  callName: {
    fontSize: 14,
    fontWeight: '600',
  },
  callDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
});
