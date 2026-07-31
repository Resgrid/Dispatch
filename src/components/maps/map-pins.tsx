import Mapbox from '@rnmapbox/maps';
import React from 'react';

import { isPoiMarker } from '@/lib/destination-helpers';
import { hasValidMapCoordinates } from '@/lib/map-markers';
import { type MapMakerInfoData } from '@/models/v4/mapping/getMapDataAndMarkersData';

import PinMarker from './pin-marker';

interface MapPinsProps {
  pins: MapMakerInfoData[];
  onPinPress?: (pin: MapMakerInfoData) => void;
}

/**
 * Anchor point for markers:
 * - POI markers (36x48): anchor [18, 48] = {x: 0.5, y: 1.0} (bottom-center)
 * - Non-POI markers (32x37): anchor [16, 37] = {x: 0.5, y: 1.0} (bottom-center)
 */
const BOTTOM_CENTER_ANCHOR = { x: 0.5, y: 1.0 };

const MapPins = React.memo<MapPinsProps>(({ pins, onPinPress }) => {
  return (
    <>
      {pins
        .filter((pin) => hasValidMapCoordinates(pin))
        .map((pin) => (
          <Mapbox.MarkerView key={`pin-${pin.Id}`} id={`pin-${pin.Id}`} coordinate={[pin.Longitude, pin.Latitude]} anchor={BOTTOM_CENTER_ANCHOR} allowOverlap={true}>
            <PinMarker pin={pin} size={32} onPress={onPinPress} />
          </Mapbox.MarkerView>
        ))}
    </>
  );
});

export default MapPins;
