import { formatCoordinate, formatStoredCoordinate, isSameCoordinateSpot, parseCoordinate, parseCoordinateEntry, splitCoordinatePair } from '../call-coordinates';

describe('parseCoordinate', () => {
  it('reads signed decimal degrees', () => {
    expect(parseCoordinate('39.122639', 'latitude')).toEqual({ status: 'valid', value: 39.122639 });
    expect(parseCoordinate('-119.758773', 'longitude')).toEqual({ status: 'valid', value: -119.758773 });
    expect(parseCoordinate('+45', 'latitude')).toEqual({ status: 'valid', value: 45 });
    expect(parseCoordinate('  12.5  ', 'longitude')).toEqual({ status: 'valid', value: 12.5 });
  });

  it('treats a blank input as empty, not invalid', () => {
    expect(parseCoordinate('', 'latitude')).toEqual({ status: 'empty' });
    expect(parseCoordinate('   ', 'longitude')).toEqual({ status: 'empty' });
    expect(parseCoordinate(undefined, 'latitude')).toEqual({ status: 'empty' });
  });

  it('keeps each axis on the globe', () => {
    expect(parseCoordinate('90', 'latitude').status).toBe('valid');
    expect(parseCoordinate('-90', 'latitude').status).toBe('valid');
    expect(parseCoordinate('90.000001', 'latitude').status).toBe('invalid');
    expect(parseCoordinate('-119.75', 'latitude').status).toBe('invalid');
    expect(parseCoordinate('180', 'longitude').status).toBe('valid');
    expect(parseCoordinate('-180.5', 'longitude').status).toBe('invalid');
  });

  it('refuses anything that is not plain decimal notation', () => {
    for (const text of ['39.', '.5', '39,12', '1e2', '39°07\'21"', '39.1N', 'abc', '39.1.2', '--39', '1234.5', '39 12']) {
      expect(parseCoordinate(text, 'longitude').status).toBe('invalid');
    }
  });
});

describe('parseCoordinateEntry', () => {
  it('is a point once both inputs are valid', () => {
    expect(parseCoordinateEntry('39.122639', '-119.758773')).toEqual({ status: 'valid', latitude: 39.122639, longitude: -119.758773 });
  });

  it('is empty when both inputs are blank', () => {
    expect(parseCoordinateEntry('', ' ')).toEqual({ status: 'empty' });
  });

  it('names the half that is missing', () => {
    expect(parseCoordinateEntry('39.1', '')).toEqual({ status: 'incomplete', missing: 'longitude' });
    expect(parseCoordinateEntry('', '-119.7')).toEqual({ status: 'incomplete', missing: 'latitude' });
  });

  it('says which input is invalid, even when the other is blank', () => {
    expect(parseCoordinateEntry('95', '-119.7')).toEqual({ status: 'invalid', latitudeInvalid: true, longitudeInvalid: false });
    expect(parseCoordinateEntry('', 'west')).toEqual({ status: 'invalid', latitudeInvalid: false, longitudeInvalid: true });
  });
});

describe('splitCoordinatePair', () => {
  it('splits a pasted "lat, lon" pair as typed', () => {
    expect(splitCoordinatePair('39.122639, -119.758773')).toEqual({ latitude: '39.122639', longitude: '-119.758773' });
    expect(splitCoordinatePair('39.122639,-119.758773')).toEqual({ latitude: '39.122639', longitude: '-119.758773' });
    expect(splitCoordinatePair(' 39.122639 -119.758773 ')).toEqual({ latitude: '39.122639', longitude: '-119.758773' });
  });

  it('leaves a single value, or a pair off the globe, to the input it was typed in', () => {
    expect(splitCoordinatePair('39.122639')).toBeNull();
    expect(splitCoordinatePair('-119.758773, 39.122639')).toBeNull();
    expect(splitCoordinatePair('39.1, ')).toBeNull();
  });
});

describe('formatting and comparing', () => {
  it('shows a point to six places', () => {
    expect(formatCoordinate(39.12263912345)).toBe('39.122639');
    expect(formatCoordinate(-119.7)).toBe('-119.700000');
  });

  it('reads a stored coordinate, or nothing when it is not a number', () => {
    expect(formatStoredCoordinate('39.1226391')).toBe('39.122639');
    expect(formatStoredCoordinate('')).toBe('');
    expect(formatStoredCoordinate(null)).toBe('');
    expect(formatStoredCoordinate('n/a')).toBe('');
  });

  it('matches points that show the same in the inputs', () => {
    expect(isSameCoordinateSpot({ latitude: 39.1226391, longitude: -119.7587734 }, { latitude: 39.122639, longitude: -119.758773 })).toBe(true);
    expect(isSameCoordinateSpot({ latitude: 39.12264, longitude: -119.758773 }, { latitude: 39.122639, longitude: -119.758773 })).toBe(false);
    expect(isSameCoordinateSpot(null, { latitude: 1, longitude: 2 })).toBe(false);
  });
});
