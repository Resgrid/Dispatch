import { getPinEntityId, isCallPin, isPinForCall, MapPinType } from '../map-pin-ids';

const personId = '4f1c2b7e-0000-4000-8000-00000000abcd';

describe('map pin ids', () => {
  describe('getPinEntityId', () => {
    it.each([
      ['c123', MapPinType.Call, '123'],
      ['u12', MapPinType.Unit, '12'],
      ['s5', MapPinType.Station, '5'],
      [`p${personId}`, MapPinType.Personnel, personId],
      ['poi9', MapPinType.Poi, '9'],
      ['hydrant-44', MapPinType.Hydrant, '44'],
    ])('strips the type prefix from %s', (id, type, expected) => {
      expect(getPinEntityId({ Id: id, Type: type })).toBe(expected);
    });

    it('matches the prefix case-insensitively', () => {
      expect(getPinEntityId({ Id: 'C123', Type: MapPinType.Call })).toBe('123');
    });

    it.each([
      ['123', MapPinType.Call],
      ['12', MapPinType.Unit],
      ['9', MapPinType.Poi],
      [personId, MapPinType.Personnel],
    ])('leaves the legacy unprefixed id %s unchanged', (id, type) => {
      expect(getPinEntityId({ Id: id, Type: type })).toBe(id);
    });

    it('does not strip a prefix from a numeric type when the rest is not a number', () => {
      expect(getPinEntityId({ Id: 'cat', Type: MapPinType.Call })).toBe('cat');
      expect(getPinEntityId({ Id: 'poison', Type: MapPinType.Poi })).toBe('poison');
    });

    it('does not strip a prefix that belongs to another pin type', () => {
      expect(getPinEntityId({ Id: 'u12', Type: MapPinType.Call })).toBe('u12');
    });

    it('leaves ids of unknown pin types and empty ids alone', () => {
      expect(getPinEntityId({ Id: 'x7', Type: 99 })).toBe('x7');
      expect(getPinEntityId({ Id: '', Type: MapPinType.Call })).toBe('');
      expect(getPinEntityId({ Id: 'c', Type: MapPinType.Call })).toBe('c');
      expect(getPinEntityId({ Id: undefined as unknown as string, Type: MapPinType.Call })).toBe('');
    });
  });

  describe('isCallPin', () => {
    it('is true only for call pins', () => {
      expect(isCallPin({ Type: MapPinType.Call })).toBe(true);
      expect(isCallPin({ Type: MapPinType.Unit })).toBe(false);
      expect(isCallPin({ Type: MapPinType.Personnel })).toBe(false);
    });
  });

  describe('isPinForCall', () => {
    it('matches a prefixed or legacy call pin against the bare call id', () => {
      expect(isPinForCall({ Id: 'c123', Type: MapPinType.Call }, '123')).toBe(true);
      expect(isPinForCall({ Id: '123', Type: MapPinType.Call }, 123)).toBe(true);
    });

    it('does not match other calls, other pin types or a missing call id', () => {
      expect(isPinForCall({ Id: 'c123', Type: MapPinType.Call }, '124')).toBe(false);
      expect(isPinForCall({ Id: 'u123', Type: MapPinType.Unit }, '123')).toBe(false);
      expect(isPinForCall({ Id: 'c123', Type: MapPinType.Call }, null)).toBe(false);
      expect(isPinForCall({ Id: 'c123', Type: MapPinType.Call }, '')).toBe(false);
    });
  });
});
