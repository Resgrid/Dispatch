import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';
import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native';

import { boxStyle } from './styles';

type IBoxProps = React.ComponentPropsWithoutRef<'div'> & VariantProps<typeof boxStyle> & { className?: string; style?: StyleProp<ViewStyle> };

const Box = React.forwardRef<HTMLDivElement, IBoxProps>(({ className, style, ...props }, ref) => {
  const flatStyle = Array.isArray(style) ? StyleSheet.flatten(style) : style;
  return <div ref={ref} className={boxStyle({ class: className })} style={flatStyle as React.CSSProperties} {...props} />;
});

Box.displayName = 'Box';
export { Box };
