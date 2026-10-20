import React from 'react';
import { View, ViewProps } from 'react-native';

export const SafeAreaProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => React.createElement(View, { testID: 'mock-safe-area-provider' }, children);

export const SafeAreaView = ({
  children,
  style,
}: {
  children?: React.ReactNode;
  style?: ViewProps['style'];
}) => React.createElement(View, { style, testID: 'mock-safe-area-view' }, children);

export const useSafeAreaInsets = () => ({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});
