import { RefreshCw } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';

interface AnimatedRefreshIconProps {
  isLoading: boolean;
  size?: number;
}

export const AnimatedRefreshIcon: React.FC<AnimatedRefreshIconProps> = ({ isLoading, size = 14 }) => {
  const { colorScheme } = useColorScheme();
  const iconColor = colorScheme === 'dark' ? '#9ca3af' : '#6b7280';

  return (
    <div
      style={{
        display: 'inline-flex',
        animation: isLoading ? 'rg-refresh-spin 1s linear infinite' : undefined,
      }}
    >
      <style>{'@keyframes rg-refresh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
      <RefreshCw size={size} color={iconColor} />
    </div>
  );
};
