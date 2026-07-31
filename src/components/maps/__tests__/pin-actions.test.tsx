import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';

import PinDetailModal from '../pin-detail-modal';

// Mock expo-router
const mockRouter = {
  push: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock nativewind
jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock cssInterop globally
(global as any).cssInterop = jest.fn();

// Mock lucide-react-native
jest.mock('lucide-react-native', () => ({
  MapPinIcon: () => null,
  PhoneIcon: () => null,
  RouteIcon: () => null,
  XIcon: () => null,
}));

// Mock UI components
jest.mock('@/components/ui/bottom-sheet', () => ({
  CustomBottomSheet: ({ children, isOpen }: any) => {
    const { View, Text } = require('react-native');
    return isOpen ? <View testID="bottom-sheet">{children}</View> : null;
  },
}));

jest.mock('@/components/ui/box', () => ({
  Box: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onPress, testID, ...props }: any) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity onPress={onPress} testID={testID} {...props}>{children}</TouchableOpacity>;
  },
  ButtonIcon: ({ as: IconComponent, ...props }: any) => {
    return IconComponent ? <IconComponent {...props} /> : null;
  },
  ButtonText: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/heading', () => ({
  Heading: ({ children, ...props }: any) => {
    const { Text } = require('react-native');
    return <Text {...props}>{children}</Text>;
  },
}));

jest.mock('@/components/ui/text', () => ({
  Text: ({ children, ...props }: any) => {
    const { Text: RNText } = require('react-native');
    return <RNText {...props}>{children}</RNText>;
  },
}));

jest.mock('@/components/ui/hstack', () => ({
  HStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/vstack', () => ({
  VStack: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));

jest.mock('@/components/ui/pressable', () => ({
  Pressable: ({ children, onPress, testID, ...props }: any) => {
    const { TouchableOpacity } = require('react-native');
    return <TouchableOpacity onPress={onPress} testID={testID} {...props}>{children}</TouchableOpacity>;
  },
}));

jest.mock('@/components/ui/divider', () => ({
  Divider: (props: any) => {
    const { View } = require('react-native');
    return <View {...props} />;
  },
}));

// Mock navigation
const mockOpenMapsWithDirections = jest.fn(() => Promise.resolve(true));
jest.mock('@/lib/navigation', () => ({
  openMapsWithDirections: jest.fn(() => Promise.resolve(true)),
}));

// Mock stores
const mockLocationStore = {
  latitude: 40.7128,
  longitude: -74.0060,
};

const mockShowToast = jest.fn();

const mockToastStore = {
  showToast: mockShowToast,
};

jest.mock('@/stores/app/location-store', () => ({
  useLocationStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockLocationStore);
    }
    return mockLocationStore;
  }),
}));

jest.mock('@/stores/toast/store', () => ({
  useToastStore: jest.fn((selector) => {
    if (typeof selector === 'function') {
      return selector(mockToastStore);
    }
    return mockToastStore;
  }),
}));

const mockCallPin = {
  Id: '123',
  Title: 'Medical Emergency',
  Latitude: 40.7128,
  Longitude: -74.0060,
  ImagePath: 'call',
  Type: 0,
  InfoWindowContent: 'Medical emergency at Main St',
  Color: '#ff0000',
  zIndex: 1,
  PoiImage: '',
  Marker: '',
  PoiTypeId: null,
  PoiTypeName: '',
  Address: '',
  Note: '',
  LayerId: '',
  LayerName: '',
};

const mockUnitPin = {
  Id: '456',
  Title: 'Engine 1',
  Latitude: 40.7580,
  Longitude: -73.9855,
  ImagePath: 'engine_available',
  Type: 2,
  InfoWindowContent: 'Engine 1 available',
  Color: '#00ff00',
  zIndex: 1,
  PoiImage: '',
  Marker: '',
  PoiTypeId: null,
  PoiTypeName: '',
  Address: '',
  Note: '',
  LayerId: '',
  LayerName: '',
};

describe('Pin Actions Integration Tests', () => {
  const mockOnClose = jest.fn();
  const mockOnSetAsCurrentCall = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockShowToast.mockClear();

    // Get reference to the mocked function and reset it
    const mockNav = require('@/lib/navigation');
    mockNav.openMapsWithDirections.mockClear();
    mockNav.openMapsWithDirections.mockResolvedValue(true);
  });

  describe('Routing functionality', () => {
    it('should successfully route to call location', async () => {
      const mockNav = require('@/lib/navigation');
      mockNav.openMapsWithDirections.mockResolvedValueOnce(true);

      render(
        <PinDetailModal
          pin={mockCallPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      const routeButton = screen.getByText('common.route');
      fireEvent.press(routeButton);

      await waitFor(() => {
        expect(mockNav.openMapsWithDirections).toHaveBeenCalledWith(
          40.7128,
          -74.0060,
          'Medical Emergency',
          40.7128,
          -74.0060
        );
      }, { timeout: 2000 });

      expect(mockShowToast).not.toHaveBeenCalled();
    });

    it('should successfully route to unit location', async () => {
      const mockNav = require('@/lib/navigation');
      mockNav.openMapsWithDirections.mockResolvedValueOnce(true);

      render(
        <PinDetailModal
          pin={mockUnitPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      const routeButton = screen.getByText('common.route');
      fireEvent.press(routeButton);

      await waitFor(() => {
        expect(mockNav.openMapsWithDirections).toHaveBeenCalledWith(
          40.7580,
          -73.9855,
          'Engine 1',
          40.7128,
          -74.0060
        );
      });
    });

    it('should handle routing failure gracefully', async () => {
      const mockNav = require('@/lib/navigation');
      mockNav.openMapsWithDirections.mockResolvedValueOnce(false);

      render(
        <PinDetailModal
          pin={mockCallPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      const routeButton = screen.getByText('common.route');
      fireEvent.press(routeButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('error', 'map.failed_to_open_maps');
      });
    });

    it('should handle routing error gracefully', async () => {
      const mockNav = require('@/lib/navigation');
      mockNav.openMapsWithDirections.mockRejectedValueOnce(new Error('GPS not available'));

      render(
        <PinDetailModal
          pin={mockCallPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      const routeButton = screen.getByText('common.route');
      fireEvent.press(routeButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('error', 'map.failed_to_open_maps');
      });
    });

    it('should show error when pin has no location data', async () => {
      const pinWithoutLocation = {
        ...mockCallPin,
        Latitude: 0,
        Longitude: 0,
      };

      render(
        <PinDetailModal
          pin={pinWithoutLocation}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      const routeButton = screen.getByText('common.route');
      fireEvent.press(routeButton);

      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith('error', 'map.no_location_for_routing');
      });

      expect(mockOpenMapsWithDirections).not.toHaveBeenCalled();
    });

    it('should route without user location when unavailable', async () => {
      // Mock location store to return null location
      const mockLocationStoreNoLocation = {
        latitude: null,
        longitude: null,
      };

      jest.mocked(require('@/stores/app/location-store').useLocationStore).mockImplementation((selector: any) => {
        if (typeof selector === 'function') {
          return selector(mockLocationStoreNoLocation);
        }
        return mockLocationStoreNoLocation;
      });

      const mockNav = require('@/lib/navigation');
      mockNav.openMapsWithDirections.mockResolvedValueOnce(true);

      render(
        <PinDetailModal
          pin={mockCallPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      const routeButton = screen.getByText('common.route');
      fireEvent.press(routeButton);

      await waitFor(() => {
        expect(mockNav.openMapsWithDirections).toHaveBeenCalledWith(
          40.7128,
          -74.0060,
          'Medical Emergency',
          undefined,
          undefined
        );
      });
    });
  });

  describe('Call detail navigation', () => {
    it('should navigate to call details for call pins', async () => {
      render(
        <PinDetailModal
          pin={mockCallPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      const viewDetailsButton = screen.getByText('map.view_call_details');
      fireEvent.press(viewDetailsButton);

      expect(mockRouter.push).toHaveBeenCalledWith('/call/123');
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not show call details button for non-call pins', () => {
      render(
        <PinDetailModal
          pin={mockUnitPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      expect(screen.queryByText('map.view_call_details')).toBeFalsy();
    });
  });

  describe('Set as current call functionality', () => {
    it('should set call as current call for call pins', async () => {
      render(
        <PinDetailModal
          pin={mockCallPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      const setCurrentCallButton = screen.getByText('map.set_as_current_call');
      fireEvent.press(setCurrentCallButton);

      expect(mockOnSetAsCurrentCall).toHaveBeenCalledWith(mockCallPin);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not show set as current call button for non-call pins', () => {
      render(
        <PinDetailModal
          pin={mockUnitPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      expect(screen.queryByText('map.set_as_current_call')).toBeFalsy();
    });
  });

  describe('Pin type detection', () => {
    it('should detect call pin by ImagePath', () => {
      const callPinByImagePath = {
        ...mockCallPin,
        ImagePath: 'call',
        Type: 0,
      };

      render(
        <PinDetailModal
          pin={callPinByImagePath}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      expect(screen.getByText('map.view_call_details')).toBeTruthy();
      expect(screen.getByText('map.set_as_current_call')).toBeTruthy();
    });

    it('should detect call pin by Type', () => {
      const callPinByType = {
        ...mockCallPin,
        ImagePath: 'other',
        Type: 0,
      };

      render(
        <PinDetailModal
          pin={callPinByType}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      expect(screen.getByText('map.view_call_details')).toBeTruthy();
      expect(screen.getByText('map.set_as_current_call')).toBeTruthy();
    });

    it('should detect non-call pin correctly', () => {
      const nonCallPin = {
        ...mockUnitPin,
        ImagePath: 'truck',
        Type: 2,
      };

      render(
        <PinDetailModal
          pin={nonCallPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      expect(screen.queryByText('map.view_call_details')).toBeFalsy();
      expect(screen.queryByText('map.set_as_current_call')).toBeFalsy();
    });
  });

  describe('Modal behavior', () => {
    it('should close modal when close button is pressed', () => {
      render(
        <PinDetailModal
          pin={mockCallPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      const closeButton = screen.getByTestId('close-pin-detail');
      fireEvent.press(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not render when closed', () => {
      render(
        <PinDetailModal
          pin={mockCallPin}
          isOpen={false}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      expect(screen.queryByText('Medical Emergency')).toBeFalsy();
    });
  });

  describe('Pin information display', () => {
    it('should display all pin information correctly', () => {
      render(
        <PinDetailModal
          pin={mockCallPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      expect(screen.getByText('Medical Emergency')).toBeTruthy();
      expect(screen.getByText('40.712800, -74.006000')).toBeTruthy();
      expect(screen.getByText('Medical emergency at Main St')).toBeTruthy();
      expect(screen.getByText('map.pin_color')).toBeTruthy();
    });

    it('should handle missing pin information gracefully', () => {
      const minimalPin = {
        Id: '999',
        Title: 'Minimal Pin',
        Latitude: 40.7128,
        Longitude: -74.0060,
        ImagePath: 'generic',
        Type: 0,
        InfoWindowContent: '',
        Color: '',
        zIndex: 0,
        PoiImage: '',
        Marker: '',
        PoiTypeId: null,
        PoiTypeName: '',
        Address: '',
        Note: '',
        LayerId: '',
        LayerName: '',
      };

      render(
        <PinDetailModal
          pin={minimalPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      expect(screen.getByText('Minimal Pin')).toBeTruthy();
      expect(screen.getByText('40.712800, -74.006000')).toBeTruthy();
      expect(screen.queryByText('map.pin_color')).toBeFalsy();
    });
  });

  describe('Error handling', () => {
    it('should handle missing onSetAsCurrentCall prop gracefully', () => {
      render(
        <PinDetailModal
          pin={mockCallPin}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={undefined}
        />
      );

      const setCurrentCallButton = screen.getByText('map.set_as_current_call');
      fireEvent.press(setCurrentCallButton);

      // Should not crash and should not call onClose since onSetAsCurrentCall is undefined
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should handle missing pin ID gracefully', () => {
      const pinWithoutId = {
        ...mockCallPin,
        Id: '',
      };

      render(
        <PinDetailModal
          pin={pinWithoutId}
          isOpen={true}
          onClose={mockOnClose}
          onSetAsCurrentCall={mockOnSetAsCurrentCall}
        />
      );

      // Should still show the modal but call details button should not navigate
      expect(screen.getByText('map.view_call_details')).toBeTruthy();
    });
  });
}); 