import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { MAP_ICONS } from '@/constants/map-icons';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import PinMarker from '../pin-marker';

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

// The POI shape marker is an SVG; stand in plain views so the test can find it.
jest.mock('react-native-svg', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children?: React.ReactNode }) => mockReact.createElement(View, { testID: 'poi-shape' }, children),
    Path: () => null,
  };
});

// expo-image is a native view; stand in a plain View that keeps the props the component sets.
jest.mock('expo-image', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => mockReact.createElement(View, { ...props, testID: 'uploaded-icon' }),
  };
});

const ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/c7.png';

const pin = (patch: Partial<MapMakerInfoData>): MapMakerInfoData =>
  ({ Id: '7', Title: 'Structure Fire', Latitude: 39.5, Longitude: -119.8, ImagePath: '', PoiImage: '', Marker: '', LayerId: '', PoiTypeId: null, Type: 0, ...patch }) as MapMakerInfoData;

const hidden = { includeHiddenElements: true };

describe('PinMarker type icons', () => {
  it('shows the call type icon on a call pin instead of the bundled icon', () => {
    render(<PinMarker pin={pin({ Type: 0, ImagePath: 'fire', IconUrl: ICON_URL })} />);

    expect(screen.getByTestId('uploaded-icon', hidden).props.source).toEqual({ uri: ICON_URL });
    expect(screen.UNSAFE_queryAllByProps({ fadeDuration: 0 })).toHaveLength(0);
  });

  it('falls back to the bundled icon when the call type icon fails to load', () => {
    render(<PinMarker pin={pin({ Type: 0, ImagePath: 'fire', IconUrl: ICON_URL })} />);

    fireEvent(screen.getByTestId('uploaded-icon', hidden), 'error');

    expect(screen.queryByTestId('uploaded-icon', hidden)).toBeNull();
    expect(screen.UNSAFE_queryAllByProps({ fadeDuration: 0 }).length).toBeGreaterThan(0);
  });

  it('keeps the bundled icon when the pin has no uploaded icon', () => {
    render(<PinMarker pin={pin({ Type: 1, ImagePath: 'ambulance' })} />);

    expect(screen.queryByTestId('uploaded-icon', hidden)).toBeNull();
    expect(screen.UNSAFE_queryAllByProps({ fadeDuration: 0 }).length).toBeGreaterThan(0);
  });

  it('shows the POI type icon instead of the shape marker, and the shape marker when it fails to load', () => {
    render(<PinMarker pin={pin({ Type: 4, PoiTypeId: 5, PoiImage: 'map-icon-hospital', Marker: 'MAP_PIN', IconUrl: ICON_URL })} />);

    expect(screen.getByTestId('uploaded-icon', hidden)).toBeTruthy();
    expect(screen.queryByTestId('poi-shape')).toBeNull();

    fireEvent(screen.getByTestId('uploaded-icon', hidden), 'error');

    expect(screen.queryByTestId('uploaded-icon', hidden)).toBeNull();
    expect(screen.getByTestId('poi-shape')).toBeTruthy();
  });

  describe('personnel pins (Type 3)', () => {
    const ROLE_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/r4.png';
    const person = (patch: Partial<MapMakerInfoData> = {}) => pin({ Id: 'p1f6a', Title: 'Jane Doe', Type: 3, ImagePath: 'Person_RespondingCall', ...patch });
    const bundledImages = () => screen.UNSAFE_queryAllByProps({ fadeDuration: 0 });

    it("shows the role's uploaded icon as a square the size of other uploaded pins", () => {
      render(<PinMarker pin={person({ IconUrl: ROLE_ICON_URL })} size={32} />);

      const icon = screen.getByTestId('uploaded-icon', hidden);
      expect(icon.props.source).toEqual({ uri: ROLE_ICON_URL });
      expect(icon.props.style).toEqual(expect.objectContaining({ width: 32, height: 32 }));
      expect(bundledImages()).toHaveLength(0);
      expect(screen.getByText('Jane Doe')).toBeTruthy();
    });

    it('falls back to the bundled person pin when the role icon fails to load', () => {
      render(<PinMarker pin={person({ IconUrl: ROLE_ICON_URL })} />);

      fireEvent(screen.getByTestId('uploaded-icon', hidden), 'error');

      expect(screen.queryByTestId('uploaded-icon', hidden)).toBeNull();
      expect(bundledImages()[0].props.source).toBe(MAP_ICONS.person_respondingcall.uri);
    });

    it("keeps the bundled person pin when none of the person's roles has an icon", () => {
      render(<PinMarker pin={person({ IconUrl: null })} />);

      expect(screen.queryByTestId('uploaded-icon', hidden)).toBeNull();
      expect(bundledImages()[0].props.source).toBe(MAP_ICONS.person_respondingcall.uri);
    });
  });

  it('keeps the POI shape marker when the POI type has no uploaded icon', () => {
    render(<PinMarker pin={pin({ Type: 4, PoiTypeId: 5, PoiImage: 'map-icon-hospital', IconUrl: null })} />);

    expect(screen.getByTestId('poi-shape')).toBeTruthy();
    expect(screen.queryByTestId('uploaded-icon', hidden)).toBeNull();
  });
});

describe('PinMarker status / priority pins', () => {
  const PIN_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/engine-responding?v=1';
  const UPLOADED_ICON_URL = 'https://api.resgrid.dev/api/v4/TypeIcons/u12.png?s=responding&v=1';
  const unit = (patch: Partial<MapMakerInfoData> = {}) => pin({ Id: 'u12', Title: 'Engine 41', Type: 1, ImagePath: 'Engine_Responding', ...patch });
  const remoteImages = () => screen.queryAllByTestId('uploaded-icon', hidden);
  const bundledImages = () => screen.UNSAFE_queryAllByProps({ fadeDuration: 0 });

  it("draws the status pin in the bundled pin's 32px box with the bundled pin's cover fit and no tint", () => {
    render(<PinMarker pin={unit({ PinIconUrl: PIN_ICON_URL, IconStyle: 'responding' })} size={32} />);

    const [image] = remoteImages();
    expect(remoteImages()).toHaveLength(1);
    expect(image.props.source).toEqual({ uri: PIN_ICON_URL });
    expect(image.props.contentFit).toBe('cover');
    expect(image.props.style).toEqual(expect.objectContaining({ width: 32, height: 32 }));
    expect(image.props.style.tintColor).toBeUndefined();
    expect(image.props.tintColor).toBeUndefined();
    expect(bundledImages()).toHaveLength(0);
    expect(screen.getByText('Engine 41')).toBeTruthy();
  });

  it('falls back to the bundled pin when the status pin fails to load', () => {
    render(<PinMarker pin={unit({ PinIconUrl: PIN_ICON_URL })} />);

    fireEvent(remoteImages()[0], 'error');

    expect(remoteImages()).toHaveLength(0);
    expect(bundledImages()[0].props.source).toBe(MAP_ICONS.engine_responding.uri);
  });

  it('prefers the uploaded icon, then the status pin, then the bundled pin as each fails to load', () => {
    render(<PinMarker pin={unit({ IconUrl: UPLOADED_ICON_URL, PinIconUrl: PIN_ICON_URL })} />);

    expect(remoteImages()).toHaveLength(1);
    expect(remoteImages()[0].props.source).toEqual({ uri: UPLOADED_ICON_URL });
    expect(remoteImages()[0].props.contentFit).toBe('contain');

    fireEvent(remoteImages()[0], 'error');
    expect(remoteImages()).toHaveLength(1);
    expect(remoteImages()[0].props.source).toEqual({ uri: PIN_ICON_URL });
    expect(remoteImages()[0].props.contentFit).toBe('cover');

    fireEvent(remoteImages()[0], 'error');
    expect(remoteImages()).toHaveLength(0);
    expect(bundledImages()[0].props.source).toBe(MAP_ICONS.engine_responding.uri);
  });

  it('draws the new status pin when the status changes, even after the previous one failed to load', () => {
    const view = render(<PinMarker pin={unit({ PinIconUrl: PIN_ICON_URL })} />);
    fireEvent(remoteImages()[0], 'error');
    expect(remoteImages()).toHaveLength(0);

    const ON_SCENE_PIN = 'https://api.resgrid.dev/api/v4/TypeIcons/Pins/engine-onscene?v=1';
    view.rerender(<PinMarker pin={unit({ PinIconUrl: ON_SCENE_PIN, IconStyle: 'onscene' })} />);

    expect(remoteImages()[0].props.source).toEqual({ uri: ON_SCENE_PIN });
  });

  it('keeps the bundled pin without a usable status pin', () => {
    render(<PinMarker pin={unit({ PinIconUrl: '/api/v4/TypeIcons/Pins/engine-responding' })} />);

    expect(remoteImages()).toHaveLength(0);
    expect(bundledImages()[0].props.source).toBe(MAP_ICONS.engine_responding.uri);
  });

  it('never draws a status pin on a POI marker', () => {
    render(<PinMarker pin={pin({ Type: 4, PoiTypeId: 5, PoiImage: 'map-icon-hospital', Marker: 'MAP_PIN', PinIconUrl: PIN_ICON_URL })} />);

    expect(screen.getByTestId('poi-shape')).toBeTruthy();
    expect(remoteImages()).toHaveLength(0);
  });
});
