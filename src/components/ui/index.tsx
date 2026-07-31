import { styled } from 'nativewind';
import Svg from 'react-native-svg';

//export * from './button';
export * from './checkbox';
export * from './cover';
export * from './focus-aware-status-bar';
//export * from './image';
//export * from './input';
//export * from './list';
//export * from './modal';
//export * from './progress-bar';
//export * from './select';
//export * from './text';
//export * from './utils';

// export base components from react-native
export { ActivityIndicator, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';
export { SafeAreaView } from 'react-native-safe-area-context';

// Svg with className resolved into style (NativeWind v5 styled wrapper)
export const StyledSvg = styled(Svg, {
  className: {
    target: 'style',
  },
});
