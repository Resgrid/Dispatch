import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { UnitTypeIcon } from '@/components/units/unit-type-icon';
import { MAP_ICONS } from '@/constants/map-icons';
import { getTypeIconUrl, getTypeMapIcon } from '@/lib/type-icons';

import { TypeIcon } from '../type-icon';

// expo-image is a native view; stand in a plain View that keeps the props the component sets.
jest.mock('expo-image', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => mockReact.createElement(View, { ...props, testID: props.testID ?? 'expo-image' }),
  };
});

const ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/u12.png';

// The icon is decorative (hidden from screen readers), so it is looked up with hidden elements included.
const getIcon = (testID: string) => screen.getByTestId(testID, { includeHiddenElements: true });
const queryIcon = (testID: string) => screen.queryByTestId(testID, { includeHiddenElements: true });

describe('TypeIcon', () => {
  it('shows the uploaded icon when the type has one', () => {
    render(<TypeIcon iconUrl={ICON_URL} mapIcon="ambulance" size={30} testID="type-icon" />);

    const image = getIcon('type-icon-url');
    expect(image.props.source).toEqual({ uri: ICON_URL });
    expect(image.props.contentFit).toBe('contain');
    expect(image.props.cachePolicy).toBe('memory-disk');
    expect(image.props.style).toEqual(expect.objectContaining({ width: 30, height: 30 }));
    expect(queryIcon('type-icon-map')).toBeNull();
  });

  it('shows the built-in map icon when there is no upload, matching the name case-insensitively', () => {
    render(<TypeIcon iconUrl={null} mapIcon="Ambulance" testID="type-icon" />);

    const image = getIcon('type-icon-map');
    expect(image.props.source).toBe(MAP_ICONS.ambulance.uri);
    expect(image.props.resizeMode).toBe('contain');
    expect(image.props.style).toEqual(expect.objectContaining({ width: 24, height: 24 }));
  });

  it('shows a call type built-in icon the same way', () => {
    render(<TypeIcon mapIcon="caraccident" testID="type-icon" />);

    expect(getIcon('type-icon-map').props.source).toBe(MAP_ICONS.caraccident.uri);
  });

  it('renders the fallback when the type has no icon', () => {
    render(<TypeIcon iconUrl={undefined} mapIcon={undefined} fallback={<Text>truck</Text>} testID="type-icon" />);

    expect(screen.getByText('truck')).toBeTruthy();
    expect(queryIcon('type-icon')).toBeNull();
  });

  it('renders nothing by default when the type has no icon', () => {
    const { toJSON } = render(<TypeIcon />);

    expect(toJSON()).toBeNull();
  });

  it('falls back when the built-in name is unknown to this build', () => {
    render(<TypeIcon mapIcon="constructor" fallback={<Text>truck</Text>} />);

    expect(screen.getByText('truck')).toBeTruthy();
  });

  it('ignores an icon URL that is not an absolute http(s) URL', () => {
    render(<TypeIcon iconUrl="javascript:alert(1)" fallback={<Text>truck</Text>} testID="type-icon" />);

    expect(queryIcon('type-icon-url')).toBeNull();
    expect(screen.getByText('truck')).toBeTruthy();
  });

  it('falls through to the map icon, then the fallback, as images fail to load', () => {
    render(<TypeIcon iconUrl={ICON_URL} mapIcon="ambulance" fallback={<Text>truck</Text>} testID="type-icon" />);

    fireEvent(getIcon('type-icon-url'), 'error');
    expect(queryIcon('type-icon-url')).toBeNull();
    expect(getIcon('type-icon-map')).toBeTruthy();

    fireEvent(getIcon('type-icon-map'), 'error');
    expect(queryIcon('type-icon-map')).toBeNull();
    expect(screen.getByText('truck')).toBeTruthy();
  });

  it('goes straight to the fallback when the upload fails and there is no map icon', () => {
    render(<TypeIcon iconUrl={ICON_URL} fallback={<Text>truck</Text>} testID="type-icon" />);

    fireEvent(getIcon('type-icon-url'), 'error');

    expect(queryIcon('type-icon-url')).toBeNull();
    expect(screen.getByText('truck')).toBeTruthy();
  });

  it('tries a new upload URL even after a previous one failed', () => {
    const { rerender } = render(<TypeIcon iconUrl={ICON_URL} fallback={<Text>truck</Text>} testID="type-icon" />);
    fireEvent(getIcon('type-icon-url'), 'error');
    expect(screen.getByText('truck')).toBeTruthy();

    const nextUrl = 'https://api.resgrid.dev/api/v4/TypeIcons/u13.png';
    rerender(<TypeIcon iconUrl={nextUrl} fallback={<Text>truck</Text>} testID="type-icon" />);

    expect(getIcon('type-icon-url').props.source).toEqual({ uri: nextUrl });
  });

  it('applies containerStyle to the box around a rendered icon only', () => {
    render(<TypeIcon mapIcon="fire" containerStyle={{ marginRight: 10 }} testID="type-icon" />);

    expect(getIcon('type-icon').props.style).toEqual(expect.arrayContaining([{ marginRight: 10 }]));
  });

  it('is hidden from screen readers', () => {
    render(<TypeIcon mapIcon="ambulance" testID="type-icon" />);

    expect(screen.queryByTestId('type-icon')).toBeNull();
    const container = getIcon('type-icon');
    expect(container.props.accessibilityElementsHidden).toBe(true);
    expect(container.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('is the component the unit surfaces use as UnitTypeIcon', () => {
    expect(UnitTypeIcon).toBe(TypeIcon);
  });
});

describe('type icon helpers', () => {
  it('accepts only absolute http(s) URLs for uploads', () => {
    expect(getTypeIconUrl(` ${ICON_URL} `)).toBe(ICON_URL);
    expect(getTypeIconUrl('http://localhost:5151/icon.png')).toBe('http://localhost:5151/icon.png');
    expect(getTypeIconUrl('/api/v4/TypeIcons/u12.png')).toBeNull();
    expect(getTypeIconUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(getTypeIconUrl('')).toBeNull();
    expect(getTypeIconUrl(null)).toBeNull();
    expect(getTypeIconUrl(undefined)).toBeNull();
  });

  it('resolves built-in names to MAP_ICONS entries the way map pins do', () => {
    expect(getTypeMapIcon('ambulance')).toBe(MAP_ICONS.ambulance);
    expect(getTypeMapIcon(' CarTwo ')).toBe(MAP_ICONS.cartwo);
    expect(getTypeMapIcon('engine_available')).toBe(MAP_ICONS.engine_available);
    expect(getTypeMapIcon('firstaid')).toBe(MAP_ICONS.firstaid);
    expect(getTypeMapIcon('constructor')).toBeUndefined();
    expect(getTypeMapIcon('__proto__')).toBeUndefined();
    expect(getTypeMapIcon('not-an-icon')).toBeUndefined();
    expect(getTypeMapIcon('')).toBeUndefined();
    expect(getTypeMapIcon(null)).toBeUndefined();
  });
});
