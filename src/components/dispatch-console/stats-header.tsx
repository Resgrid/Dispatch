import { AlertTriangle, CalendarClock, Clock, CloudLightning, Phone, Truck, User, Users } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

import { WeatherWidget } from './weather-widget';

interface StatItemProps {
  icon: React.ComponentType<any>;
  label: string;
  value: number | string;
  color: string;
  darkColor: string;
  bgClassName?: string;
  bgColor?: string;
  darkBgColor?: string;
  onPress?: () => void;
}

const StatItem: React.FC<StatItemProps> = React.memo(({ icon, label, value, color, darkColor, bgClassName, bgColor, darkBgColor, onPress }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const displayColor = isDark ? darkColor : color;
  const backgroundColor = bgColor || darkBgColor ? (isDark ? darkBgColor : bgColor) : undefined;

  return (
    <Pressable onPress={onPress} disabled={!onPress} className="flex-1" testID={onPress ? `stat-${label}` : undefined}>
      <HStack className={`flex-1 items-center rounded-lg p-2 ${bgClassName || ''}`} space="sm" style={backgroundColor ? { backgroundColor } : undefined}>
        <View style={StyleSheet.flatten([styles.iconContainer, { backgroundColor: displayColor }])}>
          <Icon as={icon} size="sm" color="#fff" />
        </View>
        <VStack>
          <Text style={{ color: displayColor }} className="text-lg font-bold">
            {value}
          </Text>
          <Text className="text-xs text-gray-600 dark:text-gray-400">{label}</Text>
        </VStack>
      </HStack>
    </Pressable>
  );
});

StatItem.displayName = 'StatItem';

/**
 * Ticking clock, isolated in its own leaf.
 *
 * Held in StatsHeader the 1s interval re-rendered every stat tile and the weather widget once a
 * second; here only the <Text/> below re-renders.
 */
const LiveClock: React.FC = React.memo(() => {
  const [currentTime, setCurrentTime] = React.useState(new Date().toLocaleTimeString('en-US', { hour12: false }));

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return <Text className="text-sm font-bold text-gray-800 dark:text-gray-100">{currentTime}</Text>;
});

LiveClock.displayName = 'LiveClock';

interface StatsHeaderProps {
  activeCalls: number;
  pendingCalls: number;
  scheduledCalls: number;
  unitsAvailable: number;
  personnelAvailable: number;
  personnelOnDuty: number;
  weatherLatitude?: number | null;
  weatherLongitude?: number | null;
  extremeAlerts?: number;
  severeAlerts?: number;
  onWeatherAlertsPress?: () => void;
}

const StatsHeaderComponent: React.FC<StatsHeaderProps> = ({
  activeCalls,
  pendingCalls,
  scheduledCalls,
  unitsAvailable,
  personnelAvailable,
  personnelOnDuty,
  weatherLatitude,
  weatherLongitude,
  extremeAlerts = 0,
  severeAlerts = 0,
  onWeatherAlertsPress,
}) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Box className="border-b border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
      <HStack className="flex-wrap items-center justify-between" space="sm">
        {/* Active Calls */}
        <StatItem icon={AlertTriangle} label={t('dispatch.active_calls')} value={activeCalls} color="#ef4444" darkColor="#f87171" bgClassName="bg-error-50 dark:bg-error-950" />

        {/* Pending Calls */}
        <StatItem icon={Phone} label={t('dispatch.pending_calls')} value={pendingCalls} color="#f59e0b" darkColor="#fbbf24" bgClassName="bg-warning-50 dark:bg-warning-950" />

        {/* Scheduled Calls */}
        <StatItem icon={CalendarClock} label={t('dispatch.scheduled_calls')} value={scheduledCalls} color="#0ea5e9" darkColor="#38bdf8" bgClassName="bg-info-50 dark:bg-info-950" />

        {/* Units Available */}
        <StatItem icon={Truck} label={t('dispatch.units_available')} value={unitsAvailable} color="#22c55e" darkColor="#4ade80" bgClassName="bg-success-50 dark:bg-success-950" />

        {/* Personnel Available */}
        <StatItem icon={User} label={t('dispatch.personnel_available')} value={personnelAvailable} color="#6366f1" darkColor="#818cf8" bgColor="#f8f9ff" darkBgColor="#1e1b4b" />

        {/* Personnel On Duty */}
        <StatItem icon={Users} label={t('dispatch.personnel_on_duty')} value={personnelOnDuty} color="#8b5cf6" darkColor="#a78bfa" bgColor="#faf8ff" darkBgColor="#2e1065" />

        {/* Weather Alerts (Extreme / Severe) - only shown when such alerts are active */}
        {extremeAlerts + severeAlerts > 0 ? (
          <StatItem
            icon={CloudLightning}
            label={t('weatherAlerts.stats_label')}
            value={`${extremeAlerts} / ${severeAlerts}`}
            color="#7b1fa2"
            darkColor="#ba68c8"
            bgColor="#f3e5f5"
            darkBgColor="#4a148c"
            onPress={onWeatherAlertsPress}
          />
        ) : null}

        {/* Current Time & Weather */}
        <HStack className="flex-1 items-center justify-center rounded-lg bg-gray-100 p-2 dark:bg-gray-800" space="sm">
          <HStack className="items-center" space="xs">
            <Clock size={14} className="text-gray-600 dark:text-gray-300" />
            <LiveClock />
          </HStack>
          <View style={StyleSheet.flatten([styles.divider, { backgroundColor: isDark ? '#4b5563' : '#d1d5db' }])} />
          <WeatherWidget latitude={weatherLatitude} longitude={weatherLongitude} compact />
        </HStack>
      </HStack>
    </Box>
  );
};

export const StatsHeader = React.memo(StatsHeaderComponent);

StatsHeader.displayName = 'StatsHeader';

const styles = StyleSheet.create({
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: 24,
  },
});
