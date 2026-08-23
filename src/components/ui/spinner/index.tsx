'use client';
import { tva } from '@gluestack-ui/utils/nativewind-utils';
import { styled } from 'nativewind';
import React from 'react';
import { ActivityIndicator } from 'react-native';

const StyledActivityIndicator = styled(ActivityIndicator, {
  // A prop path, not `true`: react-native-css calls `.split('.')` on the value, so a boolean
  // crashes as soon as the className resolves to a colour.
  className: { target: 'style', nativeStyleMapping: { color: 'color' } },
});

const spinnerStyle = tva({});

type ISpinnerProps = React.ComponentProps<typeof ActivityIndicator>;

const Spinner = React.forwardRef<React.ElementRef<typeof ActivityIndicator>, ISpinnerProps>(({ className, color, ...props }, ref) => {
  return <StyledActivityIndicator ref={ref} {...props} color={color} className={spinnerStyle({ class: className })} />;
});

Spinner.displayName = 'Spinner';

export { Spinner };
