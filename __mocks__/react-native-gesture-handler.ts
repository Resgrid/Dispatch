// Manual Jest mock for react-native-gesture-handler.
// RNGH 2.28 no longer ships src/mocks.js (the library mocks moved to
// src/mocks/mocks), so re-export them and add the named exports the app
// imports (ScrollView, GestureHandlerRootView, Gesture, GestureDetector).
/* eslint-disable @typescript-eslint/no-explicit-any */
const RN = require('react-native');
const libraryMocks = require('react-native-gesture-handler/src/mocks/mocks');
const { State } = require('react-native-gesture-handler/src/State');
const { Directions } = require('react-native-gesture-handler/src/Directions');

// Chainable no-op gesture builder (Gesture.Pan().onStart(...).onEnd(...) etc.)
const createChainableGesture = (): any => {
  const gesture: any = {};
  const chainableMethods = [
    'onBegin',
    'onStart',
    'onUpdate',
    'onChange',
    'onEnd',
    'onFinalize',
    'onTouchesDown',
    'onTouchesMove',
    'onTouchesUp',
    'onTouchesCancelled',
    'enabled',
    'shouldCancelWhenOutside',
    'hitSlop',
    'activeOffsetX',
    'activeOffsetY',
    'failOffsetX',
    'failOffsetY',
    'minDistance',
    'minPointers',
    'maxPointers',
    'minDuration',
    'maxDuration',
    'maxDelay',
    'numberOfTaps',
    'maxDistance',
    'runOnJS',
    'simultaneousWithExternalGesture',
    'requireExternalGestureToFail',
    'blocksExternalGesture',
    'withRef',
    'withTestId',
  ];
  chainableMethods.forEach((method) => {
    gesture[method] = () => gesture;
  });
  return gesture;
};

const Gesture = {
  Pan: createChainableGesture,
  Tap: createChainableGesture,
  Pinch: createChainableGesture,
  Rotation: createChainableGesture,
  Fling: createChainableGesture,
  LongPress: createChainableGesture,
  Native: createChainableGesture,
  Manual: createChainableGesture,
  Hover: createChainableGesture,
  ForceTouch: createChainableGesture,
  Simultaneous: (...gestures: any[]) => gestures[0],
  Exclusive: (...gestures: any[]) => gestures[0],
  Race: (...gestures: any[]) => gestures[0],
};

module.exports = {
  ...libraryMocks.default,
  RawButton: libraryMocks.RawButton,
  BaseButton: libraryMocks.BaseButton,
  RectButton: libraryMocks.RectButton,
  BorderlessButton: libraryMocks.BorderlessButton,
  // Named exports used by the app that the library mocks omit
  GestureHandlerRootView: RN.View,
  ScrollView: RN.ScrollView,
  RefreshControl: RN.RefreshControl,
  Gesture,
  GestureDetector: ({ children }: { children?: any }) => children ?? null,
  gestureHandlerRootHOC: (component: any) => component,
  State,
  Directions,
};
