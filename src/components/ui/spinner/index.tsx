'use client';
import { tva } from '@gluestack-ui/utils/nativewind-utils';
import { styled } from 'nativewind';
import React from 'react';
import { ActivityIndicator } from 'react-native';

const StyledActivityIndicator = styled(ActivityIndicator, {
  className: { target: 'style', nativeStyleMapping: { color: true } },
});

const spinnerStyle = tva({});

type ISpinnerProps = React.ComponentProps<typeof ActivityIndicator>;

const Spinner = React.forwardRef<React.ElementRef<typeof ActivityIndicator>, ISpinnerProps>(({ className, color, ...props }, ref) => {
  return <StyledActivityIndicator ref={ref} {...props} color={color} className={spinnerStyle({ class: className })} />;
});

Spinner.displayName = 'Spinner';

export { Spinner };
