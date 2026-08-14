import { type Href, useRouter } from 'expo-router';
import { Building2Icon, MapPinIcon, PhoneIcon, RouteIcon, XIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { isCallMarker, isPoiMarker } from '@/lib/destination-helpers';
import { getMapPinSummary, hasValidMapCoordinates } from '@/lib/map-markers';
import { openMapsWithDirections } from '@/lib/navigation';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';
import { useLocationStore } from '@/stores/app/location-store';
import { useToastStore } from '@/stores/toast/store';

interface PinDetailModalProps {
  pin: MapMakerInfoData | null;
  isOpen: boolean;
  onClose: () => void;
  onSetAsCurrentCall?: (pin: MapMakerInfoData) => void;
}

export const PinDetailModal: React.FC<PinDetailModalProps> = ({ pin, isOpen, onClose, onSetAsCurrentCall }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const router = useRouter();
  const showToast = useToastStore((state) => state.showToast);
  // Selected field by field: an object selector builds a new reference on every store
  // write, so this re-rendered on every GPS fix.
  const userLatitude = useLocationStore((state) => state.latitude);
  const userLongitude = useLocationStore((state) => state.longitude);

  if (!pin) return null;

  const isCallPin = isCallMarker(pin.Type, pin.ImagePath);
  const isPoiPin = isPoiMarker({
    type: pin.Type,
    poiTypeId: pin.PoiTypeId,
    layerId: pin.LayerId,
    imagePath: pin.ImagePath,
    poiImage: pin.PoiImage,
  });
  const summaryText = getMapPinSummary(pin);

  const handleRouteToLocation = async () => {
    if (!hasValidMapCoordinates(pin)) {
      showToast('error', t('map.no_location_for_routing'));
      return;
    }

    try {
      const success = await openMapsWithDirections(pin.Latitude, pin.Longitude, pin.Title, userLatitude || undefined, userLongitude || undefined);

      if (!success) {
        showToast('error', t('map.failed_to_open_maps'));
      }
    } catch (error) {
      showToast('error', t('map.failed_to_open_maps'));
    }
  };

  const handleViewCallDetails = () => {
    if (isCallPin && pin.Id) {
      router.push(`/call/${pin.Id}` as Href);
      onClose();
    }
  };

  const handleViewPoiDetails = () => {
    if (isPoiPin && pin.Id) {
      router.push(`/poi/${pin.Id}` as Href);
      onClose();
    }
  };

  const handleSetAsCurrentCall = () => {
    if (isCallPin && onSetAsCurrentCall) {
      onSetAsCurrentCall(pin);
      onClose();
    }
  };

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose}>
      <Box className="p-6">
        <HStack className="mb-4 items-center justify-between">
          <Heading size="lg">{pin.Title}</Heading>
          <Pressable onPress={onClose} testID="close-pin-detail">
            <XIcon size={24} color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
          </Pressable>
        </HStack>

        <VStack className="mb-6 space-y-3">
          <Box className="flex-row items-center">
            <MapPinIcon size={16} color={colorScheme === 'dark' ? '#FFFFFF' : '#000000'} />
            <Text className="ml-2 text-sm text-gray-600">
              {pin.Latitude.toFixed(6)}, {pin.Longitude.toFixed(6)}
            </Text>
          </Box>

          {summaryText ? (
            <Box>
              <Text className="text-sm">{summaryText}</Text>
            </Box>
          ) : null}

          {pin.Color ? (
            <Box className="flex-row items-center">
              <Box className="mr-2 size-4 rounded-full" style={{ backgroundColor: pin.Color }} />
              <Text className="text-sm text-gray-600">{t('map.pin_color')}</Text>
            </Box>
          ) : null}
        </VStack>

        <Divider className="my-4" />

        <VStack className="space-y-3">
          {/* Route to location button - always available */}
          <Button onPress={handleRouteToLocation} variant="outline" className="w-full">
            <ButtonIcon as={RouteIcon} />
            <ButtonText>{t('common.route')}</ButtonText>
          </Button>

          {/* Call-specific actions */}
          {isCallPin ? (
            <>
              <Button onPress={handleViewCallDetails} variant="outline" className="w-full">
                <ButtonIcon as={PhoneIcon} />
                <ButtonText>{t('map.view_call_details')}</ButtonText>
              </Button>

              <Button onPress={handleSetAsCurrentCall} className="w-full">
                <ButtonIcon as={PhoneIcon} />
                <ButtonText>{t('map.set_as_current_call')}</ButtonText>
              </Button>
            </>
          ) : null}

          {isPoiPin ? (
            <Button onPress={handleViewPoiDetails} variant="outline" className="w-full">
              <ButtonIcon as={Building2Icon} />
              <ButtonText>{t('map.view_poi_details')}</ButtonText>
            </Button>
          ) : null}
        </VStack>
      </Box>
    </CustomBottomSheet>
  );
};

export default PinDetailModal;
