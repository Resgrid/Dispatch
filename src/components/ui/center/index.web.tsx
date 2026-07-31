import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';

import { centerStyle } from './styles';

type ICenterProps = React.ComponentPropsWithoutRef<'div'> & VariantProps<typeof centerStyle> & { style?: StyleProp<ViewStyle> };

const Center = React.forwardRef<HTMLDivElement, ICenterProps>(({ className, style, ...props }, ref) => {
  const flatStyle = Array.isArray(style) ? StyleSheet.flatten(style) : style;
  return <div className={centerStyle({ class: className })} style={flatStyle as React.CSSProperties} {...props} ref={ref} />;
});

Center.displayName = 'Center';

export { Center };
