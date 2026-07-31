import { Box, Loader2 } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { HStack } from '../ui/hstack';
import { Spinner } from '../ui/spinner';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';
interface LoadingProps {
  /**
   * Text to display below the spinner
   * @default undefined
   */
  text?: string;

  /**
   * Whether to show a fullscreen overlay
   * @default false
   */
  fullscreen?: boolean;

  /**
   * Size of the spinner
   * @default "lg"
   */
  size?: 'small' | 'large';

  /**
   * Type of loading indicator
   * @default "spinner"
   */
  type?: 'spinner' | 'dots' | 'icon';

  /**
   * Whether to show a transparent background
   * @default false
   */
  transparent?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ text, fullscreen = false, size = 'large', type = 'spinner', transparent = false }) => {
  const { t } = useTranslation();
  const loadingText = text || t('common:loading');

  const containerClasses = `items-center justify-center ${fullscreen ? 'absolute inset-0 z-50' : ''} ${transparent ? 'bg-transparent' : 'bg-background/80'}`;

  const renderLoadingIndicator = () => {
    switch (type) {
      case 'dots':
        return (
          <HStack space="sm" className="items-center">
            {[1, 2, 3].map((i) => (
              <Box key={i} className={`bg-primary rounded-full ${size === 'small' ? 'size-2' : size === 'large' ? 'size-3' : 'size-4'} animate-pulse`} />
            ))}
          </HStack>
        );
      case 'icon':
        return <Loader2 size={size === 'small' ? 24 : size === 'large' ? 32 : 40} className="text-primary animate-spin" />;
      case 'spinner':
      default:
        return <Spinner size={size} className="text-primary" />;
    }
  };

  return (
    <View className={containerClasses}>
      <VStack space="sm" className="items-center rounded-xl p-4">
        {renderLoadingIndicator()}
        {loadingText && <Text className={`text-foreground mt-2 font-medium text-blue-400 ${size === 'small' ? 'text-xs' : size === 'large' ? 'text-sm' : 'text-base'}`}>{loadingText}</Text>}
      </VStack>
    </View>
  );
};

/**
 * A skeleton loading placeholder component
 */
interface SkeletonProps {
  /**
   * Width of the skeleton
   * @default "100%"
   */
  width?: string | number;

  /**
   * Height of the skeleton
   * @default 20
   */
  height?: string | number;

  /**
   * Border radius of the skeleton
   * @default "md"
   */
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';

  /**
   * Whether the skeleton is currently loading
   * @default true
   */
  isLoading?: boolean;

  /**
   * Content to render when not loading
   */
  children?: React.ReactNode;
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = 20, borderRadius = 'md', isLoading = true, children }) => {
  if (!isLoading) {
    return <>{children}</>;
  }

  const radiusMap = {
    none: 'rounded-none',
    sm: 'rounded-xs',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  return <Box className={`bg-muted/30 animate-pulse ${radiusMap[borderRadius]}`} style={{ width: width as number, height: height as number }} />;
};

/**
 * A list skeleton loading component
 */
export const ListSkeleton: React.FC<{
  count?: number;
  height?: number;
  spacing?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'xs' | '3xl' | '4xl';
}> = ({ count = 5, height = 60, spacing = 'sm' }) => {
  return (
    <VStack space={spacing} className="w-full">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} height={height} />
      ))}
    </VStack>
  );
};

/**
 * A card skeleton loading component
 */
export const CardSkeleton: React.FC<{
  hasImage?: boolean;
  hasFooter?: boolean;
}> = ({ hasImage = true, hasFooter = true }) => {
  return (
    <Box className="bg-card border-border w-full rounded-lg border p-4">
      {hasImage && <Skeleton height={200} borderRadius="md" />}
      <VStack space="sm" className="mt-4">
        <Skeleton width="60%" height={24} />
        <Skeleton height={16} />
        <Skeleton height={16} />
        <Skeleton width="80%" height={16} />
      </VStack>
      {hasFooter && (
        <HStack className="mt-4 justify-between">
          <Skeleton width={80} height={32} borderRadius="full" />
          <Skeleton width={80} height={32} borderRadius="full" />
        </HStack>
      )}
    </Box>
  );
};

/**
 * A profile skeleton loading component
 */
export const ProfileSkeleton: React.FC = () => {
  return (
    <VStack className="w-full items-center p-4">
      <Skeleton width={100} height={100} borderRadius="full" />
      <VStack space="sm" className="mt-4 w-full items-center">
        <Skeleton width="50%" height={24} />
        <Skeleton width="70%" height={16} />
      </VStack>
      <VStack space="md" className="mt-6 w-full">
        <Skeleton height={50} />
        <Skeleton height={50} />
        <Skeleton height={50} />
      </VStack>
    </VStack>
  );
};
