import { Appearance } from 'react-native';

import { storage } from '../../storage';
import { loadSelectedTheme } from '../use-selected-theme';

// Mock the storage module
jest.mock('../../storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  useMMKVString: jest.fn(() => ['system', jest.fn()]),
}));

const mockedStorage = storage as jest.Mocked<typeof storage>;

describe('loadSelectedTheme', () => {
  let setColorSchemeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    setColorSchemeSpy = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    console.error = jest.fn();
  });

  afterEach(() => {
    setColorSchemeSpy.mockRestore();
  });

  it('should load and apply saved theme from storage', () => {
    mockedStorage.getString.mockReturnValue('dark');

    loadSelectedTheme();

    expect(mockedStorage.getString).toHaveBeenCalledWith('SELECTED_THEME');
    expect(setColorSchemeSpy).toHaveBeenCalledWith('dark');
  });

  it('should handle no saved theme gracefully', () => {
    mockedStorage.getString.mockReturnValue(undefined);

    loadSelectedTheme();

    expect(mockedStorage.getString).toHaveBeenCalledWith('SELECTED_THEME');
    expect(setColorSchemeSpy).not.toHaveBeenCalled();
  });

  it('should handle storage errors gracefully', () => {
    const error = new Error('Storage error');
    mockedStorage.getString.mockImplementation(() => {
      throw error;
    });

    loadSelectedTheme();

    expect(console.error).toHaveBeenCalledWith('Failed to load selected theme:', error);
    expect(setColorSchemeSpy).not.toHaveBeenCalled();
  });

  it('should apply light theme correctly', () => {
    mockedStorage.getString.mockReturnValue('light');

    loadSelectedTheme();

    expect(setColorSchemeSpy).toHaveBeenCalledWith('light');
  });

  it('should clear the override for system theme', () => {
    mockedStorage.getString.mockReturnValue('system');

    loadSelectedTheme();

    expect(setColorSchemeSpy).toHaveBeenCalledWith(null);
  });
});
