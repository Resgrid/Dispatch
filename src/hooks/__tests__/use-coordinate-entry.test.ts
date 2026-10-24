import { act, renderHook } from '@testing-library/react-native';

import { reverseGeocode } from '@/api/geocoding/geocoding';
import { COORDINATE_ENTRY_DELAY_MS, useCoordinateEntry, type UseCoordinateEntryOptions } from '@/hooks/use-coordinate-entry';

jest.mock('@/api/geocoding/geocoding', () => ({ reverseGeocode: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const mockedReverseGeocode = reverseGeocode as jest.Mock;

const setup = (overrides: Partial<UseCoordinateEntryOptions> = {}) => {
  let props: UseCoordinateEntryOptions = {
    latitudeText: '',
    longitudeText: '',
    setText: jest.fn(),
    location: null,
    address: '',
    onLocationEntered: jest.fn(),
    setAddress: jest.fn(),
    onCleared: jest.fn(),
    ...overrides,
  };
  const hook = renderHook((p: UseCoordinateEntryOptions) => useCoordinateEntry(p), { initialProps: props });
  const update = (changes: Partial<UseCoordinateEntryOptions>) => {
    props = { ...props, ...changes };
    hook.rerender(props);
  };

  return { hook, update, props: () => props };
};

// Lets the pause run out and the reverse geocode that follows it settle.
const pause = async () => {
  await act(async () => {
    jest.advanceTimersByTime(COORDINATE_ENTRY_DELAY_MS);
  });
  await act(async () => {
    for (let tick = 0; tick < 5; tick++) await Promise.resolve();
  });
};

describe('useCoordinateEntry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockedReverseGeocode.mockResolvedValue({ succeeded: true, address: '4924 Ponderosa Drive, Carson City, NV' });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves the pin once both values are in and the dispatcher pauses, and fills a blank address', async () => {
    const { update, props } = setup();

    update({ latitudeText: '39.122639', longitudeText: '-119.758773' });
    await act(async () => {
      jest.advanceTimersByTime(COORDINATE_ENTRY_DELAY_MS - 1);
    });
    expect(props().onLocationEntered).not.toHaveBeenCalled();

    await pause();

    expect(props().onLocationEntered).toHaveBeenCalledWith({ latitude: 39.122639, longitude: -119.758773 });
    expect(mockedReverseGeocode).toHaveBeenCalledWith(39.122639, -119.758773);
    expect(props().setAddress).toHaveBeenCalledWith('4924 Ponderosa Drive, Carson City, NV');
  });

  it('never replaces an address the dispatcher supplied', async () => {
    const { update, props } = setup({ address: '4924 Ponderosa Dr (rear building)' });

    update({ latitudeText: '39.122639', longitudeText: '-119.758773' });
    await pause();

    expect(props().onLocationEntered).toHaveBeenCalledWith({ latitude: 39.122639, longitude: -119.758773 });
    expect(mockedReverseGeocode).not.toHaveBeenCalled();
    expect(props().setAddress).not.toHaveBeenCalled();
  });

  it('waits for both values before moving the pin', async () => {
    const { update, props } = setup();

    update({ latitudeText: '39.122639' });
    await pause();

    expect(props().onLocationEntered).not.toHaveBeenCalled();
  });

  it('leaves the pin and address alone when the inputs show where the pin already is', async () => {
    const { update, props } = setup({ location: { latitude: 39.1226391234, longitude: -119.7587731234 } });

    update({ latitudeText: '39.122639', longitudeText: '-119.758773' });
    await pause();

    expect(props().onLocationEntered).not.toHaveBeenCalled();
    expect(mockedReverseGeocode).not.toHaveBeenCalled();
  });

  it('flags an invalid value after the pause, and clears the flag once it is fixed', async () => {
    const { hook, update } = setup();

    update({ latitudeText: '95', longitudeText: '-119.758773' });
    expect(hook.result.current.latitudeError).toBeUndefined();

    await pause();
    expect(hook.result.current.latitudeError).toBe('calls.latitude_invalid');
    expect(hook.result.current.longitudeError).toBeUndefined();

    update({ latitudeText: '39.122639' });
    expect(hook.result.current.latitudeError).toBeUndefined();
  });

  it('splits a pasted "lat, lon" pair across both inputs', () => {
    const { hook, props } = setup();

    act(() => hook.result.current.changeText('latitude', '39.122639, -119.758773'));

    expect(props().setText).toHaveBeenCalledWith('latitude', '39.122639');
    expect(props().setText).toHaveBeenCalledWith('longitude', '-119.758773');
  });

  it('applies the inputs at once on commit and flags a missing half', async () => {
    const { hook, update, props } = setup();

    update({ latitudeText: '39.122639' });
    let entry: ReturnType<typeof hook.result.current.commit> | undefined;
    act(() => {
      entry = hook.result.current.commit();
    });

    expect(entry).toEqual({ status: 'incomplete', missing: 'longitude' });
    expect(hook.result.current.longitudeError).toBe('calls.coordinates_incomplete');

    update({ longitudeText: '-119.758773' });
    await act(async () => {
      entry = hook.result.current.commit();
      for (let tick = 0; tick < 5; tick++) await Promise.resolve();
    });

    expect(entry).toEqual({ status: 'valid', latitude: 39.122639, longitude: -119.758773 });
    expect(props().onLocationEntered).toHaveBeenCalledTimes(1);
  });

  it('keeps the pin precision when committing inputs that echo it', () => {
    const location = { latitude: 39.1226391234, longitude: -119.7587731234 };
    const { hook } = setup({ location, latitudeText: '39.122639', longitudeText: '-119.758773' });

    let entry: ReturnType<typeof hook.result.current.commit> | undefined;
    act(() => {
      entry = hook.result.current.commit();
    });

    expect(entry).toEqual({ status: 'valid', ...location });
  });

  it('reports both inputs emptied', async () => {
    const { update, props } = setup({ location: { latitude: 39.1, longitude: -119.7 }, latitudeText: '39.1', longitudeText: '-119.7' });

    update({ latitudeText: '', longitudeText: '' });
    await pause();

    expect(props().onCleared).toHaveBeenCalled();
  });

  it('replaces an address it filled in itself when the point moves, but not one the dispatcher has since edited', async () => {
    const { update, props } = setup();

    update({ latitudeText: '39.122639', longitudeText: '-119.758773' });
    await pause();
    update({ address: '4924 Ponderosa Drive, Carson City, NV', location: { latitude: 39.122639, longitude: -119.758773 } });

    mockedReverseGeocode.mockResolvedValue({ succeeded: true, address: '100 N Carson St, Carson City, NV' });
    update({ latitudeText: '39.1638' });
    await pause();
    expect(props().setAddress).toHaveBeenLastCalledWith('100 N Carson St, Carson City, NV');

    update({ address: '100 N Carson St, Suite 2', location: { latitude: 39.1638, longitude: -119.758773 } });
    update({ latitudeText: '39.2' });
    await pause();
    expect(props().setAddress).toHaveBeenCalledTimes(2);
  });

  it('does not overwrite an address typed while the lookup was running', async () => {
    let resolveLookup: (value: { succeeded: boolean; address: string }) => void = () => undefined;
    mockedReverseGeocode.mockReturnValue(new Promise((resolve) => (resolveLookup = resolve)));
    const { update, props } = setup();

    update({ latitudeText: '39.122639', longitudeText: '-119.758773' });
    await act(async () => {
      jest.advanceTimersByTime(COORDINATE_ENTRY_DELAY_MS);
    });
    update({ address: 'Rear barn, 4924 Ponderosa' });
    await act(async () => {
      resolveLookup({ succeeded: true, address: '4924 Ponderosa Drive' });
      for (let tick = 0; tick < 5; tick++) await Promise.resolve();
    });

    expect(props().setAddress).not.toHaveBeenCalled();
    expect(props().onLocationEntered).toHaveBeenCalled();
  });

  it('drops a lookup still running when both inputs are emptied', async () => {
    let resolveLookup: (value: { succeeded: boolean; address: string }) => void = () => undefined;
    mockedReverseGeocode.mockReturnValue(new Promise((resolve) => (resolveLookup = resolve)));
    const { hook, update, props } = setup();

    update({ latitudeText: '39.122639', longitudeText: '-119.758773' });
    await act(async () => {
      jest.advanceTimersByTime(COORDINATE_ENTRY_DELAY_MS);
    });
    expect(hook.result.current.isLookingUpAddress).toBe(true);

    update({ location: { latitude: 39.122639, longitude: -119.758773 }, latitudeText: '', longitudeText: '' });
    await act(async () => {
      jest.advanceTimersByTime(COORDINATE_ENTRY_DELAY_MS);
    });
    expect(props().onCleared).toHaveBeenCalled();
    expect(hook.result.current.isLookingUpAddress).toBe(false);

    await act(async () => {
      resolveLookup({ succeeded: true, address: '4924 Ponderosa Drive' });
      for (let tick = 0; tick < 5; tick++) await Promise.resolve();
    });

    expect(props().setAddress).not.toHaveBeenCalled();
  });

  it('fills a blank address from a map pick with the address the picker found, without a lookup', async () => {
    const { hook, props } = setup();

    await act(async () => {
      await hook.result.current.fillAddress({ latitude: 39.1, longitude: -119.7 }, 'Picked Street');
    });

    expect(mockedReverseGeocode).not.toHaveBeenCalled();
    expect(props().setAddress).toHaveBeenCalledWith('Picked Street');
  });

  it('leaves a dispatcher address alone on a map pick', async () => {
    const { hook, props } = setup({ address: 'Known address' });

    await act(async () => {
      await hook.result.current.fillAddress({ latitude: 39.1, longitude: -119.7 }, 'Picked Street');
      await hook.result.current.fillAddress({ latitude: 39.1, longitude: -119.7 });
    });

    expect(mockedReverseGeocode).not.toHaveBeenCalled();
    expect(props().setAddress).not.toHaveBeenCalled();
  });
});
