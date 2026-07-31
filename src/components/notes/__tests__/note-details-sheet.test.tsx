import { render } from '@testing-library/react-native';
import React from 'react';

import { NoteDetailsSheet } from '../note-details-sheet';

// Mock react-native-webview
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
  };
});

// Mock dependencies
jest.mock('@/hooks/use-analytics');
jest.mock('@/stores/notes/store');
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('nativewind', () => ({
  styled: jest.fn((Component: any) => Component),
  useColorScheme: () => ({ colorScheme: 'light' }),
  cssInterop: jest.fn(),
}));

// Mock cssInterop globally
(global as any).cssInterop = jest.fn();

jest.mock('@/lib/utils', () => ({
  formatDateForDisplay: jest.fn((date) => date),
  parseDateISOString: jest.fn((dateString) => dateString),
}));

const mockTrackEvent = jest.fn();
const mockCloseDetails = jest.fn();
const mockDeleteNote = jest.fn();

describe('NoteDetailsSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup analytics mock
    require('@/hooks/use-analytics').useAnalytics.mockReturnValue({
      trackEvent: mockTrackEvent,
    });
  });

  describe('Analytics', () => {
    it('should track analytics event when note details sheet is opened', () => {
      const mockNote = {
        NoteId: 'note-123',
        Title: 'Test Note',
        Body: 'This is a test note body',
        Category: 'Important',
        AddedOn: '2023-01-01T10:00:00Z',
      };

      // Setup store mock
      require('@/stores/notes/store').useNotesStore.mockReturnValue({
        notes: [mockNote],
        selectedNoteId: 'note-123',
        isDetailsOpen: true,
        closeDetails: mockCloseDetails,
        deleteNote: mockDeleteNote,
      });

      render(<NoteDetailsSheet />);

      expect(mockTrackEvent).toHaveBeenCalledWith('note_details_sheet_opened', {
        noteId: 'note-123',
        hasCategory: true,
        hasBody: true,
        bodyLength: 24,
        hasAddedDate: true,
      });
    });

    it('should not track analytics event when sheet is closed', () => {
      const mockNote = {
        NoteId: 'note-123',
        Title: 'Test Note',
        Body: 'This is a test note body',
        Category: 'Important',
        AddedOn: '2023-01-01T10:00:00Z',
      };

      // Setup store mock with closed sheet
      require('@/stores/notes/store').useNotesStore.mockReturnValue({
        notes: [mockNote],
        selectedNoteId: 'note-123',
        isDetailsOpen: false,
        closeDetails: mockCloseDetails,
        deleteNote: mockDeleteNote,
      });

      render(<NoteDetailsSheet />);

      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should not track analytics event when no note is selected', () => {
      // Setup store mock with no selected note
      require('@/stores/notes/store').useNotesStore.mockReturnValue({
        notes: [],
        selectedNoteId: null,
        isDetailsOpen: true,
        closeDetails: mockCloseDetails,
        deleteNote: mockDeleteNote,
      });

      render(<NoteDetailsSheet />);

      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('should track analytics event with correct flags for note without optional data', () => {
      const minimalNote = {
        NoteId: 'note-minimal',
        Title: 'Minimal Note',
        Body: '',
        Category: null,
        AddedOn: null,
      };

      // Setup store mock
      require('@/stores/notes/store').useNotesStore.mockReturnValue({
        notes: [minimalNote],
        selectedNoteId: 'note-minimal',
        isDetailsOpen: true,
        closeDetails: mockCloseDetails,
        deleteNote: mockDeleteNote,
      });

      render(<NoteDetailsSheet />);

      expect(mockTrackEvent).toHaveBeenCalledWith('note_details_sheet_opened', {
        noteId: 'note-minimal',
        hasCategory: false,
        hasBody: false,
        bodyLength: 0,
        hasAddedDate: false,
      });
    });

    it('should track analytics event only once when isDetailsOpen changes from false to true', () => {
      const mockNote = {
        NoteId: 'note-123',
        Title: 'Test Note',
        Body: 'Test body',
        Category: 'Test',
        AddedOn: '2023-01-01T10:00:00Z',
      };

      // Setup store mock with closed sheet initially
      const mockStore = {
        notes: [mockNote],
        selectedNoteId: 'note-123',
        isDetailsOpen: false,
        closeDetails: mockCloseDetails,
        deleteNote: mockDeleteNote,
      };

      require('@/stores/notes/store').useNotesStore.mockReturnValue(mockStore);

      const { rerender } = render(<NoteDetailsSheet />);

      // Should not track when initially closed
      expect(mockTrackEvent).not.toHaveBeenCalled();

      // Update store to opened state
      mockStore.isDetailsOpen = true;
      require('@/stores/notes/store').useNotesStore.mockReturnValue(mockStore);

      rerender(<NoteDetailsSheet />);

      // Should track when opened
      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      expect(mockTrackEvent).toHaveBeenCalledWith('note_details_sheet_opened', {
        noteId: 'note-123',
        hasCategory: true,
        hasBody: true,
        bodyLength: 9,
        hasAddedDate: true,
      });

      // Should not track again when staying open
      rerender(<NoteDetailsSheet />);

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    });
  });
});
