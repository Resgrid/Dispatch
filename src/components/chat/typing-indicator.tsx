import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated } from 'react-native';

import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';

/** Three subtly pulsing dots used by the typing / assistant-thinking rows. */
export function TypingDots({ color = '#9ca3af' }: { color?: string }) {
  const dots = useRef([new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]).current;

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 150),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots]);

  return (
    <HStack space="xs" className="items-center">
      {dots.map((dot, index) => (
        <Animated.View key={index} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: dot }} />
      ))}
    </HStack>
  );
}

interface TypingIndicatorProps {
  names: string[];
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  const { t } = useTranslation();
  if (names.length === 0) return null;

  const label = names.length === 1 ? t('chat.is_typing', { name: names[0] }) : t('chat.are_typing', { count: names.length });

  return (
    <HStack className="items-center px-4 py-1" space="sm">
      <TypingDots />
      <Text className="text-xs italic text-typography-400">{label}</Text>
    </HStack>
  );
}
