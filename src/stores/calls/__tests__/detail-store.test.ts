// Mock Platform first before any imports
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((specifics: any) => specifics.ios || specifics.default),
    Version: 17,
  },
}));

// Mock MMKV storage
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
  })),
  useMMKVBoolean: jest.fn(() => [false, jest.fn()]),
}));

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getCallNotes, saveCallNote } from '@/api/calls/callNotes';
import { updateCall, closeCall, getCall, getCallExtraData } from '@/api/calls/calls';
import { useCallDetailStore } from '../detail-store';

// Mock the API calls
jest.mock('@/api/calls/callNotes');
jest.mock('@/api/calls/callFiles');
jest.mock('@/api/calls/calls');

const mockGetCallNotes = getCallNotes as jest.MockedFunction<typeof getCallNotes>;
const mockSaveCallNote = saveCallNote as jest.MockedFunction<typeof saveCallNote>;
const mockUpdateCall = updateCall as jest.MockedFunction<typeof updateCall>;
const mockCloseCall = closeCall as jest.MockedFunction<typeof closeCall>;
const mockGetCall = getCall as jest.MockedFunction<typeof getCall>;
const mockGetCallExtraData = getCallExtraData as jest.MockedFunction<typeof getCallExtraData>;

describe('useCallDetailStore - Notes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store state
    useCallDetailStore.setState({
      call: null,
      callExtraData: null,
      callPriority: null,
      callNotes: [],
      isLoading: false,
      error: null,
      isNotesLoading: false,
      callImages: null,
      callFiles: null,
      isLoadingFiles: false,
      errorFiles: null,
      isLoadingImages: false,
      errorImages: null,
    });
  });

  describe('fetchCallNotes', () => {
    it('should fetch call notes successfully', async () => {
      const mockCallNotesData = [
        {
          CallId: 123,
          CallNoteId: '1',
          UserId: 'user1',
          Source: 1,
          TimestampFormatted: '2023-01-01 10:00',
          Timestamp: '2023-01-01T10:00:00Z',
          TimestampUtc: '2023-01-01T10:00:00Z',
          Note: 'First note',
          Latitude: '',
          Longitude: '',
          FullName: 'John Doe',
        },
        {
          CallId: 123,
          CallNoteId: '2',
          UserId: 'user2',
          Source: 1,
          TimestampFormatted: '2023-01-01 11:00',
          Timestamp: '2023-01-01T11:00:00Z',
          TimestampUtc: '2023-01-01T11:00:00Z',
          Note: 'Second note',
          Latitude: '',
          Longitude: '',
          FullName: 'Jane Smith',
        },
      ];

      mockGetCallNotes.mockResolvedValue({
        Data: mockCallNotesData,
      } as any);

      const { result } = renderHook(() => useCallDetailStore());

      // Verify initial state
      expect(result.current.callNotes).toEqual([]);
      expect(result.current.isNotesLoading).toBe(false);

      // Call fetchCallNotes
      await act(async () => {
        await result.current.fetchCallNotes('call123');
      });

      await waitFor(() => {
        expect(result.current.callNotes).toEqual(mockCallNotesData);
        expect(result.current.isNotesLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      expect(mockGetCallNotes).toHaveBeenCalledWith('call123');
    });

    it('should handle loading state correctly', async () => {
      mockGetCallNotes.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

      const { result } = renderHook(() => useCallDetailStore());

      // Start fetching
      act(() => {
        result.current.fetchCallNotes('call123');
      });

      // Should be loading
      expect(result.current.isNotesLoading).toBe(true);
      expect(result.current.callNotes).toEqual([]);
    });

    it('should handle fetch call notes error', async () => {
      const errorMessage = 'Network error';
      mockGetCallNotes.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.fetchCallNotes('call123');
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
        expect(result.current.isNotesLoading).toBe(false);
        expect(result.current.callNotes).toEqual([]);
      });

      expect(mockGetCallNotes).toHaveBeenCalledWith('call123');
    });

    it('should handle API response with no data', async () => {
      mockGetCallNotes.mockResolvedValue({
        Data: null,
      } as any);

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.fetchCallNotes('call123');
      });

      await waitFor(() => {
        expect(result.current.callNotes).toEqual([]);
        expect(result.current.isNotesLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('addNote', () => {
    it('should add note successfully and refetch notes', async () => {
      const mockCallNotesData = [
        {
          CallId: 123,
          CallNoteId: '1',
          UserId: 'user1',
          Source: 1,
          TimestampFormatted: '2023-01-01 12:00',
          Timestamp: '2023-01-01T12:00:00Z',
          TimestampUtc: '2023-01-01T12:00:00Z',
          Note: 'New note',
          Latitude: '',
          Longitude: '',
          FullName: 'John Doe',
        },
      ];

      mockSaveCallNote.mockResolvedValue({} as any);
      mockGetCallNotes.mockResolvedValue({
        Data: mockCallNotesData,
      } as any);

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.addNote('call123', 'New note', 'user123', null, null);
      });

      await waitFor(() => {
        expect(result.current.callNotes).toEqual(mockCallNotesData);
        expect(result.current.isNotesLoading).toBe(false);
      });

      expect(mockSaveCallNote).toHaveBeenCalledWith('call123', 'user123', 'New note', null, null);
      expect(mockGetCallNotes).toHaveBeenCalledWith('call123');
    });

    it('should add note with location coordinates', async () => {
      mockSaveCallNote.mockResolvedValue({} as any);
      mockGetCallNotes.mockResolvedValue({ Data: [] } as any);

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.addNote('call123', 'Note with location', 'user123', 45.5236, -122.675);
      });

      expect(mockSaveCallNote).toHaveBeenCalledWith('call123', 'user123', 'Note with location', 45.5236, -122.675);
    });

    it('should handle loading state during add note', async () => {
      mockSaveCallNote.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
      mockGetCallNotes.mockResolvedValue({ Data: [] } as any);

      const { result } = renderHook(() => useCallDetailStore());

      // Start adding note
      act(() => {
        result.current.addNote('call123', 'Test note', 'user123', null, null);
      });

      // Should be loading
      expect(result.current.isNotesLoading).toBe(true);
    });

    it('should handle save note error', async () => {
      const errorMessage = 'Save failed';
      mockSaveCallNote.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.addNote('call123', 'Test note', 'user123', null, null);
      });

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
        expect(result.current.isNotesLoading).toBe(false);
      });

      expect(mockSaveCallNote).toHaveBeenCalledWith('call123', 'user123', 'Test note', null, null);
      expect(mockGetCallNotes).not.toHaveBeenCalled();
    });

    it('should handle refetch error after successful save', async () => {
      mockSaveCallNote.mockResolvedValue({} as any);
      mockGetCallNotes.mockRejectedValue(new Error('Refetch failed'));

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.addNote('call123', 'Test note', 'user123', null, null);
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Refetch failed');
        expect(result.current.isNotesLoading).toBe(false);
      });

      expect(mockSaveCallNote).toHaveBeenCalledWith('call123', 'user123', 'Test note', null, null);
      expect(mockGetCallNotes).toHaveBeenCalledWith('call123');
    });
  });

  describe('searchNotes', () => {
    const mockNotes = [
      {
        CallId: 123,
        CallNoteId: '1',
        UserId: 'user1',
        Source: 1,
        TimestampFormatted: '2023-01-01 10:00',
        Timestamp: '2023-01-01T10:00:00Z',
        TimestampUtc: '2023-01-01T10:00:00Z',
        Note: 'Emergency response note',
        Latitude: '',
        Longitude: '',
        FullName: 'John Doe',
      },
      {
        CallId: 123,
        CallNoteId: '2',
        UserId: 'user2',
        Source: 1,
        TimestampFormatted: '2023-01-01 11:00',
        Timestamp: '2023-01-01T11:00:00Z',
        TimestampUtc: '2023-01-01T11:00:00Z',
        Note: 'Medical assistance required',
        Latitude: '',
        Longitude: '',
        FullName: 'Jane Smith',
      },
      {
        CallId: 123,
        CallNoteId: '3',
        UserId: 'user3',
        Source: 1,
        TimestampFormatted: '2023-01-01 12:00',
        Timestamp: '2023-01-01T12:00:00Z',
        TimestampUtc: '2023-01-01T12:00:00Z',
        Note: 'Fire department called',
        Latitude: '',
        Longitude: '',
        FullName: 'Bob Johnson',
      },
    ];

    beforeEach(() => {
      useCallDetailStore.setState({
        callNotes: mockNotes,
      });
    });

    it('should return all notes when query is empty', () => {
      const { result } = renderHook(() => useCallDetailStore());

      const filteredNotes = result.current.searchNotes('');

      expect(filteredNotes).toEqual(mockNotes);
    });

    it('should filter notes by note content', () => {
      const { result } = renderHook(() => useCallDetailStore());

      const filteredNotes = result.current.searchNotes('emergency');

      expect(filteredNotes).toEqual([mockNotes[0]]);
    });

    it('should filter notes by author name', () => {
      const { result } = renderHook(() => useCallDetailStore());

      const filteredNotes = result.current.searchNotes('jane');

      expect(filteredNotes).toEqual([mockNotes[1]]);
    });

    it('should perform case-insensitive search', () => {
      const { result } = renderHook(() => useCallDetailStore());

      const filteredNotes = result.current.searchNotes('MEDICAL');

      expect(filteredNotes).toEqual([mockNotes[1]]);
    });

    it('should return multiple matches', () => {
      const { result } = renderHook(() => useCallDetailStore());

      const filteredNotes = result.current.searchNotes('o'); // Should match 'John Doe' and 'Bob Johnson'

      expect(filteredNotes).toHaveLength(2);
      expect(filteredNotes).toEqual([mockNotes[0], mockNotes[2]]);
    });

    it('should return empty array when no matches found', () => {
      const { result } = renderHook(() => useCallDetailStore());

      const filteredNotes = result.current.searchNotes('nonexistent');

      expect(filteredNotes).toEqual([]);
    });

    it('should handle whitespace in search query', () => {
      const { result } = renderHook(() => useCallDetailStore());

      const filteredNotes = result.current.searchNotes('  emergency  ');

      expect(filteredNotes).toEqual([mockNotes[0]]);
    });
  });

  describe('Integration', () => {
    it('should maintain state consistency during multiple operations', async () => {
      const initialNotes = [
        {
          CallId: 123,
          CallNoteId: '1',
          UserId: 'user1',
          Source: 1,
          TimestampFormatted: '2023-01-01 10:00',
          Timestamp: '2023-01-01T10:00:00Z',
          TimestampUtc: '2023-01-01T10:00:00Z',
          Note: 'Initial note',
          Latitude: '',
          Longitude: '',
          FullName: 'John Doe',
        },
      ];

      const updatedNotes = [
        ...initialNotes,
        {
          CallId: 123,
          CallNoteId: '2',
          UserId: 'user2',
          Source: 1,
          TimestampFormatted: '2023-01-01 11:00',
          Timestamp: '2023-01-01T11:00:00Z',
          TimestampUtc: '2023-01-01T11:00:00Z',
          Note: 'Added note',
          Latitude: '',
          Longitude: '',
          FullName: 'Jane Smith',
        },
      ];

      // Mock initial fetch
      mockGetCallNotes.mockResolvedValueOnce({
        Data: initialNotes,
      } as any);

      // Mock save and refetch
      mockSaveCallNote.mockResolvedValue({} as any);
      mockGetCallNotes.mockResolvedValueOnce({
        Data: updatedNotes,
      } as any);

      const { result } = renderHook(() => useCallDetailStore());

      // Initial fetch
      await act(async () => {
        await result.current.fetchCallNotes('call123');
      });

      expect(result.current.callNotes).toEqual(initialNotes);

      // Add note
      await act(async () => {
        await result.current.addNote('call123', 'Added note', 'user123', null, null);
      });

      expect(result.current.callNotes).toEqual(updatedNotes);
      expect(result.current.isNotesLoading).toBe(false);
      expect(result.current.error).toBeNull();

      // Search functionality should work with updated notes
      const searchResults = result.current.searchNotes('initial');
      expect(searchResults).toEqual([initialNotes[0]]);
    });
  });

  describe('updateCall', () => {
    it('should update call successfully', async () => {
      const mockCallData = {
        callId: 'call123',
        name: 'Updated Test Call',
        nature: 'Updated Nature',
        address: '456 Updated Street',
        contactName: 'Updated Contact',
        contactInfo: 'updated@email.com',
        note: 'Updated note',
        priority: 2,
        type: 'Fire',
        latitude: 40.7589,
        longitude: -73.9851,
      };

      mockUpdateCall.mockResolvedValue({} as any);
      // Mock the fetchCallDetail dependencies
      mockGetCall.mockResolvedValue({
        Data: { CallId: 'call123', Name: 'Updated Test Call' },
      } as any);
      mockGetCallExtraData.mockResolvedValue({
        Data: { CallId: 'call123' },
      } as any);

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.updateCall(mockCallData);
      });

      expect(mockUpdateCall).toHaveBeenCalledWith(mockCallData);
      expect(mockGetCall).toHaveBeenCalledWith('call123');
      expect(mockGetCallExtraData).toHaveBeenCalledWith('call123');
    });

    it('should handle update call error', async () => {
      const errorMessage = 'Update failed';
      mockUpdateCall.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useCallDetailStore());

      await expect(
        act(async () => {
          await result.current.updateCall({
            callId: 'call123',
            name: 'Test Call',
            nature: 'Test Nature',
            address: '123 Test Street',
            contactName: 'Test Contact',
            contactInfo: 'test@email.com',
            note: 'Test note',
            priority: 1,
            type: 'Medical',
            latitude: 40.7128,
            longitude: -74.006,
          });
        })
      ).rejects.toThrow(errorMessage);

      expect(mockUpdateCall).toHaveBeenCalled();
      // A refused save is reported by the caller; it must not turn the loaded call into an error page.
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle partial update data', async () => {
      const partialData = {
        callId: 'call123',
        name: 'Updated Name Only',
        nature: 'Updated Nature Only',
      };

      mockUpdateCall.mockResolvedValue({} as any);
      // Mock the fetchCallDetail dependencies
      mockGetCall.mockResolvedValue({
        Data: { CallId: 'call123', Name: 'Updated Name Only' },
      } as any);
      mockGetCallExtraData.mockResolvedValue({
        Data: { CallId: 'call123' },
      } as any);

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.updateCall(partialData as any);
      });

      expect(mockUpdateCall).toHaveBeenCalledWith(partialData);
    });
  });

  describe('closeCall', () => {
    it('should close call successfully', async () => {
      const closeData = {
        callId: 'call123',
        type: 1, // Changed from 'resolved' to 1
        note: 'Call resolved successfully',
      };

      mockCloseCall.mockResolvedValue({} as any);

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.closeCall(closeData);
      });

      expect(mockCloseCall).toHaveBeenCalledWith(closeData);
    });

    it('should handle close call error', async () => {
      const errorMessage = 'Close call failed';
      const closeData = {
        callId: 'call123',
        type: 2, // Changed from 'cancelled' to 2
        note: 'Call cancelled',
      };

      mockCloseCall.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useCallDetailStore());

      await expect(
        act(async () => {
          await result.current.closeCall(closeData);
        })
      ).rejects.toThrow(errorMessage);

      expect(mockCloseCall).toHaveBeenCalledWith(closeData);
    });

    it('should handle close call with empty note', async () => {
      const closeData = {
        callId: 'call123',
        type: 1, // Changed from 'resolved' to 1
        note: '',
      };

      mockCloseCall.mockResolvedValue({} as any);

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.closeCall(closeData);
      });

      expect(mockCloseCall).toHaveBeenCalledWith(closeData);
    });

    it('should handle different close call types', async () => {
      const closeTypes = [1, 2, 3, 4]; // Changed from 'resolved', 'cancelled', 'transferred', 'false_alarm' to 1, 2, 3, 4

      mockCloseCall.mockResolvedValue({} as any);

      const { result } = renderHook(() => useCallDetailStore());

      for (const type of closeTypes) {
        const closeData = {
          callId: 'call123',
          type,
          note: `Call ${type}`,
        };

        await act(async () => {
          await result.current.closeCall(closeData);
        });

        expect(mockCloseCall).toHaveBeenCalledWith(closeData);
      }

      expect(mockCloseCall).toHaveBeenCalledTimes(closeTypes.length);
    });

    it('passes the notify choice through to the API', async () => {
      const closeData = { callId: 'call123', type: 1, note: '', sendNotification: false };
      mockCloseCall.mockResolvedValue({} as any);

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await result.current.closeCall(closeData);
      });

      expect(mockCloseCall).toHaveBeenCalledWith(closeData);
    });

    it('keeps the server reason when the close is refused (call has an active incident command)', async () => {
      const reason = 'This call has an active incident command. Close the incident command first, then close the call.';
      const refusal = Object.assign(new Error('Request failed with status code 400'), { isAxiosError: true, response: { status: 400, data: reason } });
      mockCloseCall.mockRejectedValue(refusal);

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await expect(result.current.closeCall({ callId: 'call123', type: 1, sendNotification: true })).rejects.toBe(refusal);
      });

      expect(result.current.error).toBe(reason);
      expect(result.current.isLoading).toBe(false);
    });

    it('falls back to the error message when the server gave no reason', async () => {
      mockCloseCall.mockRejectedValue(new Error('Network Error'));

      const { result } = renderHook(() => useCallDetailStore());

      await act(async () => {
        await expect(result.current.closeCall({ callId: 'call123', type: 1 })).rejects.toThrow('Network Error');
      });

      expect(result.current.error).toBe('Network Error');
    });
  });

  describe('Integration - Update and Close Call', () => {
    it('should maintain state consistency during update and close operations', async () => {
      const updateData = {
        callId: 'call123',
        name: 'Updated Call',
        nature: 'Updated Nature',
        address: '123 Updated Street',
        contactName: 'Updated Contact',
        contactInfo: 'updated@email.com',
        note: 'Updated note',
        priority: 2,
        type: 'Fire',
        latitude: 40.7589,
        longitude: -73.9851,
      };

      const closeData = {
        callId: 'call123',
        type: 1, // Changed from 'resolved' to 1
        note: 'Call completed successfully',
      };

      mockUpdateCall.mockResolvedValue({} as any);
      mockCloseCall.mockResolvedValue({} as any);
      // Mock the fetchCallDetail dependencies
      mockGetCall.mockResolvedValue({
        Data: { CallId: 'call123', Name: 'Updated Call' },
      } as any);
      mockGetCallExtraData.mockResolvedValue({
        Data: { CallId: 'call123' },
      } as any);

      const { result } = renderHook(() => useCallDetailStore());

      // Update call first
      await act(async () => {
        await result.current.updateCall(updateData);
      });

      expect(mockUpdateCall).toHaveBeenCalledWith(updateData);

      // Then close call
      await act(async () => {
        await result.current.closeCall(closeData);
      });

      expect(mockCloseCall).toHaveBeenCalledWith(closeData);

      // Verify store state remains consistent
      expect(result.current.error).toBeNull();
    });

    it('should handle error during update followed by successful close', async () => {
      const updateData = {
        callId: 'call123',
        name: 'Updated Call',
        nature: 'Updated Nature',
        address: '123 Updated Street',
        contactName: 'Updated Contact',
        contactInfo: 'updated@email.com',
        note: 'Updated note',
        priority: 2,
        type: 'Fire',
        latitude: 40.7589,
        longitude: -73.9851,
      };

      const closeData = {
        callId: 'call123',
        type: 1, // Changed from 'resolved' to 1
        note: 'Call completed successfully',
      };

      mockUpdateCall.mockRejectedValue(new Error('Update failed'));
      mockCloseCall.mockResolvedValue({} as any);

      const { result } = renderHook(() => useCallDetailStore());

      // Update should fail
      await expect(
        act(async () => {
          await result.current.updateCall(updateData);
        })
      ).rejects.toThrow('Update failed');

      // Close should still work
      await act(async () => {
        await result.current.closeCall(closeData);
      });

      expect(mockCloseCall).toHaveBeenCalledWith(closeData);
    });
  });
});
