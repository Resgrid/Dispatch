'use client';
import { UIIcon } from '@gluestack-ui/core/icon/creator';
import { createInput } from '@gluestack-ui/core/input/creator';
import { tva, useStyleContext, type VariantProps, withStyleContext } from '@gluestack-ui/utils/nativewind-utils';
import { styled } from 'nativewind';
import React from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';

const SCOPE = 'INPUT';

/**
 * Android field metrics, applied from JS because the class layer cannot express them correctly.
 *
 * Measured on device, each case a real Input/InputField:
 *   - the class `h-full` (height: 100%) resolves taller than the fixed-height parent on Android, and
 *     the parent's overflow-hidden then clips the top of the glyphs;
 *   - an explicit pixel height matching the parent renders correctly;
 *   - overriding only the lineHeight, at either the class or the style layer, does not help;
 *   - lineHeight 0 (what iOS uses) hides Android text completely, and a later `undefined` does not
 *     clear the value the size class sets.
 *
 * So Android gets a concrete height plus a lineHeight near the font size, and drops the extra font
 * padding. iOS keeps the zero lineHeight that upstream applied through `ios:leading-[0px]`; that class
 * is gone from the base style so the value can be chosen per platform here.
 */
const ANDROID_FIELD_METRICS: Record<string, { height: number; lineHeight: number }> = {
  sm: { height: 36, lineHeight: 18 },
  md: { height: 40, lineHeight: 20 },
  lg: { height: 44, lineHeight: 22 },
  xl: { height: 48, lineHeight: 25 },
};

const useTextFieldVerticalFix = (size: string | undefined) =>
  React.useMemo(() => {
    if (Platform.OS === 'ios') {
      return { lineHeight: 0 } as const;
    }
    if (Platform.OS === 'android') {
      const metrics = ANDROID_FIELD_METRICS[size ?? 'md'] ?? ANDROID_FIELD_METRICS.md;
      return { height: metrics.height, lineHeight: metrics.lineHeight, includeFontPadding: false, textAlignVertical: 'center' } as const;
    }
    return undefined;
  }, [size]);

const StyledUIIcon = styled(UIIcon, { className: 'style' });

const UIInput = createInput({
  Root: withStyleContext(View, SCOPE),
  Icon: StyledUIIcon,
  Slot: Pressable,
  Input: TextInput,
});

const inputStyle = tva({
  base: 'border-background-300 flex-row overflow-hidden content-center data-[hover=true]:border-outline-400 data-[focus=true]:border-primary-700 data-[focus=true]:hover:border-primary-700 data-[disabled=true]:opacity-40 data-[disabled=true]:hover:border-background-300 items-center',

  variants: {
    size: {
      xl: 'h-12',
      lg: 'h-11',
      md: 'h-10',
      sm: 'h-9',
    },

    variant: {
      underlined:
        'rounded-none border-b data-[invalid=true]:border-b-2 data-[invalid=true]:border-error-700 data-[invalid=true]:hover:border-error-700 data-[invalid=true]:data-[focus=true]:border-error-700 data-[invalid=true]:data-[focus=true]:hover:border-error-700 data-[invalid=true]:data-[disabled=true]:hover:border-error-700',

      outline:
        'rounded border data-[invalid=true]:border-error-700 data-[invalid=true]:hover:border-error-700 data-[invalid=true]:data-[focus=true]:border-error-700 data-[invalid=true]:data-[focus=true]:hover:border-error-700 data-[invalid=true]:data-[disabled=true]:hover:border-error-700 data-[focus=true]:web:ring-1 data-[focus=true]:web:ring-inset data-[focus=true]:web:ring-indicator-primary data-[invalid=true]:web:ring-1 data-[invalid=true]:web:ring-inset data-[invalid=true]:web:ring-indicator-error data-[invalid=true]:data-[focus=true]:hover:web:ring-1 data-[invalid=true]:data-[focus=true]:hover:web:ring-inset data-[invalid=true]:data-[focus=true]:hover:web:ring-indicator-error data-[invalid=true]:data-[disabled=true]:hover:web:ring-1 data-[invalid=true]:data-[disabled=true]:hover:web:ring-inset data-[invalid=true]:data-[disabled=true]:hover:web:ring-indicator-error',

      rounded:
        'rounded-full border data-[invalid=true]:border-error-700 data-[invalid=true]:hover:border-error-700 data-[invalid=true]:data-[focus=true]:border-error-700 data-[invalid=true]:data-[focus=true]:hover:border-error-700 data-[invalid=true]:data-[disabled=true]:hover:border-error-700 data-[focus=true]:web:ring-1 data-[focus=true]:web:ring-inset data-[focus=true]:web:ring-indicator-primary data-[invalid=true]:web:ring-1 data-[invalid=true]:web:ring-inset data-[invalid=true]:web:ring-indicator-error data-[invalid=true]:data-[focus=true]:hover:web:ring-1 data-[invalid=true]:data-[focus=true]:hover:web:ring-inset data-[invalid=true]:data-[focus=true]:hover:web:ring-indicator-error data-[invalid=true]:data-[disabled=true]:hover:web:ring-1 data-[invalid=true]:data-[disabled=true]:hover:web:ring-inset data-[invalid=true]:data-[disabled=true]:hover:web:ring-indicator-error',
    },
  },
});

const inputIconStyle = tva({
  base: 'justify-center items-center text-typography-400 fill-none',
  parentVariants: {
    size: {
      '2xs': 'h-3 w-3',
      xs: 'h-3.5 w-3.5',
      sm: 'h-4 w-4',
      md: 'h-[18px] w-[18px]',
      lg: 'h-5 w-5',
      xl: 'h-6 w-6',
    },
  },
});

const inputSlotStyle = tva({
  base: 'justify-center items-center web:disabled:cursor-not-allowed',
});

const inputFieldStyle = tva({
  base: 'flex-1 text-typography-900 py-0 px-3 placeholder:text-typography-500 h-full web:cursor-text web:data-[disabled=true]:cursor-not-allowed',

  parentVariants: {
    variant: {
      underlined: 'web:outline-0 web:outline-none px-0',
      outline: 'web:outline-0 web:outline-none',
      rounded: 'web:outline-0 web:outline-none px-4',
    },

    size: {
      '2xs': 'text-2xs',
      xs: 'text-xs',
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
      xl: 'text-xl',
      '2xl': 'text-2xl',
      '3xl': 'text-3xl',
      '4xl': 'text-4xl',
      '5xl': 'text-5xl',
      '6xl': 'text-6xl',
    },
  },
});

type IInputProps = React.ComponentProps<typeof UIInput> & VariantProps<typeof inputStyle> & { className?: string };
const Input = React.forwardRef<React.ComponentRef<typeof UIInput>, IInputProps>(function Input({ className, variant = 'outline', size = 'md', ...props }, ref) {
  const contextValue = React.useMemo(() => ({ variant, size }), [variant, size]);
  return <UIInput ref={ref} {...props} className={inputStyle({ variant, size, class: className })} context={contextValue} />;
});

type IInputIconProps = React.ComponentProps<typeof UIInput.Icon> &
  VariantProps<typeof inputIconStyle> & {
    className?: string;
    height?: number;
    width?: number;
  };

const InputIcon = React.forwardRef<React.ComponentRef<typeof UIInput.Icon>, IInputIconProps>(function InputIcon({ className, size, ...props }, ref) {
  const { size: parentSize } = useStyleContext(SCOPE);

  if (typeof size === 'number') {
    return <UIInput.Icon ref={ref} {...props} className={inputIconStyle({ class: className })} size={size} />;
  } else if ((props.height !== undefined || props.width !== undefined) && size === undefined) {
    return <UIInput.Icon ref={ref} {...props} className={inputIconStyle({ class: className })} />;
  }
  return (
    <UIInput.Icon
      ref={ref}
      {...props}
      className={inputIconStyle({
        parentVariants: {
          size: parentSize,
        },
        class: className,
      })}
    />
  );
});

type IInputSlotProps = React.ComponentProps<typeof UIInput.Slot> & VariantProps<typeof inputSlotStyle> & { className?: string };

const InputSlot = React.forwardRef<React.ComponentRef<typeof UIInput.Slot>, IInputSlotProps>(function InputSlot({ className, ...props }, ref) {
  return (
    <UIInput.Slot
      ref={ref}
      {...props}
      className={inputSlotStyle({
        class: className,
      })}
    />
  );
});

type IInputFieldProps = React.ComponentProps<typeof UIInput.Input> & VariantProps<typeof inputFieldStyle> & { className?: string };

const InputField = React.forwardRef<React.ComponentRef<typeof UIInput.Input>, IInputFieldProps>(function InputField({ className, style, ...props }, ref) {
  const { variant: parentVariant, size: parentSize } = useStyleContext(SCOPE);
  const verticalFix = useTextFieldVerticalFix(parentSize);

  return (
    <UIInput.Input
      ref={ref}
      {...props}
      className={inputFieldStyle({
        parentVariants: {
          variant: parentVariant,
          size: parentSize,
        },
        class: className,
      })}
      style={[verticalFix, style]}
    />
  );
});

Input.displayName = 'Input';
InputIcon.displayName = 'InputIcon';
InputSlot.displayName = 'InputSlot';
InputField.displayName = 'InputField';

export { Input, InputField, InputIcon, InputSlot };
