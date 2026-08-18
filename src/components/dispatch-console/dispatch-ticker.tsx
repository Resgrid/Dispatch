import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text as RNText, View } from 'react-native';

import { type DispatchedEventResultData } from '@/models/v4/calls/dispatchedEventResultData';

import { getDispatchTypeStyle } from './dispatch-ticker-shared';

export const DispatchBadge: React.FC<{ dispatch: DispatchedEventResultData; isOverdue?: boolean }> = React.memo(({ dispatch, isOverdue }) => {
  const ts = getDispatchTypeStyle(dispatch.Type);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOverdue) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: 500, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 500, easing: Easing.linear, useNativeDriver: true }),
        ])
      );
      blink.start();
      return () => blink.stop();
    } else {
      opacity.setValue(1);
    }
  }, [isOverdue, opacity]);

  const bgColor = isOverdue ? '#dc2626' : ts.bg;

  return (
    <Animated.View style={StyleSheet.flatten([styles.dispatchBadge, { backgroundColor: bgColor, opacity }])}>
      <RNText style={StyleSheet.flatten([styles.dispatchBadgeLabel, { color: ts.fg }])}>{ts.label}</RNText>
      <View style={styles.dispatchBadgeDivider} />
      <RNText style={StyleSheet.flatten([styles.dispatchBadgeName, { color: ts.fg }])} numberOfLines={1}>
        {dispatch.Name}
      </RNText>
    </Animated.View>
  );
});

DispatchBadge.displayName = 'DispatchBadge';

// Animated horizontal dispatch ticker with color-coded badges
export const DispatchTicker: React.FC<{
  dispatches: DispatchedEventResultData[];
  isLoading?: boolean;
  textColor?: string;
  overdueEntityIds?: Set<string>;
}> = React.memo(({ dispatches, isLoading, textColor = '#ffffff', overdueEntityIds }) => {
  // Deduplicate dispatches by Id (or Type+Name as fallback key)
  const uniqueDispatches = useMemo(() => {
    const seen = new Set<string>();
    return dispatches.filter((d) => {
      const key = d.Id || `${d.Type}:${d.Name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [dispatches]);

  const translateX = useRef(new Animated.Value(0)).current;
  const containerWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const startAnim = useCallback(() => {
    if (containerWidthRef.current <= 0 || contentWidthRef.current <= 0) return;
    animRef.current?.stop();
    if (contentWidthRef.current <= containerWidthRef.current) {
      // Content fits – no scrolling needed
      translateX.setValue(0);
      return;
    }
    translateX.setValue(containerWidthRef.current);
    const totalDistance = contentWidthRef.current + containerWidthRef.current;
    animRef.current = Animated.loop(
      Animated.timing(translateX, {
        toValue: -contentWidthRef.current,
        duration: (totalDistance / 60) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animRef.current.start();
  }, [translateX]);

  useEffect(() => {
    if (isLoading || uniqueDispatches.length === 0) {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
    }
    return () => {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
    };
  }, [isLoading, uniqueDispatches.length]);

  return (
    <View
      style={styles.tickerContainer}
      onLayout={(e) => {
        containerWidthRef.current = e.nativeEvent.layout.width;
        startAnim();
      }}
    >
      {isLoading ? (
        <RNText style={StyleSheet.flatten([styles.tickerPlaceholder, { color: `${textColor}80` }])}>…</RNText>
      ) : uniqueDispatches.length === 0 ? (
        <RNText style={StyleSheet.flatten([styles.tickerPlaceholder, { color: `${textColor}80` }])}>—</RNText>
      ) : (
        <Animated.View style={StyleSheet.flatten([styles.tickerScrollTrack, { transform: [{ translateX }] }])}>
          <View
            style={styles.tickerBadgeRow}
            onLayout={(e) => {
              contentWidthRef.current = e.nativeEvent.layout.width;
              startAnim();
            }}
          >
            {uniqueDispatches.map((d, i) => (
              <React.Fragment key={d.Id || `${d.Type}:${d.Name}`}>
                {i > 0 ? <View style={styles.tickerBadgeGap} /> : null}
                <DispatchBadge dispatch={d} isOverdue={overdueEntityIds?.has(d.Id)} />
              </React.Fragment>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
});

DispatchTicker.displayName = 'DispatchTicker';

const styles = StyleSheet.create({
  tickerContainer: {
    flex: 1,
    overflow: 'hidden',
    height: 18,
    justifyContent: 'center',
  },
  tickerScrollTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tickerBadgeGap: {
    width: 5,
  },
  tickerPlaceholder: {
    fontSize: 9,
    fontStyle: 'italic' as const,
  },
  dispatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 3,
    overflow: 'hidden',
    height: 14,
  },
  dispatchBadgeLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    paddingHorizontal: 3,
    opacity: 1,
  },
  dispatchBadgeDivider: {
    width: 1,
    height: '100%' as unknown as number,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dispatchBadgeName: {
    fontSize: 9,
    fontWeight: '500' as const,
    paddingHorizontal: 4,
  },
});
