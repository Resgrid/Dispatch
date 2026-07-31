import type { VariantProps } from '@gluestack-ui/utils/nativewind-utils';
import React from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';

import { hstackStyle } from './styles';

type IHStackProps = ViewProps & VariantProps<typeof hstackStyle>;

const HStack = React.forwardRef<React.ElementRef<typeof View>, IHStackProps>(({ className, space, reversed, ...props }, ref) => {
  return <View className={hstackStyle({ space, reversed, class: className })} {...props} ref={ref} />;
});

HStack.displayName = 'HStack';

export { HStack };
