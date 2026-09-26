import { create } from 'zustand';

import { getCallAudio, getCallFiles, getCallImages, saveCallImage } from '@/api/calls/callFiles';
import { getCallNotes, saveCallNote } from '@/api/calls/callNotes';
import { closeCall, type CloseCallRequest, deleteCall, getCall, getCallExtraData, updateCall, type UpdateCallRequest, updateScheduledDispatchTime } from '@/api/calls/calls';
import { type CallFileResultData } from '@/models/v4/callFiles/callFileResultData';
import { type CallNoteResultData } from '@/models/v4/callNotes/callNoteResultData';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import { type CallExtraDataResultData } from '@/models/v4/calls/callExtraDataResultData';
import { type CallResultData } from '@/models/v4/calls/callResultData';

import { useCallsStore } from './store';

interface CallDetailState {
  call: CallResultData | null;
  callExtraData: CallExtraDataResultData | null;
  callPriority: CallPriorityResultData | null;
  callNotes: CallNoteResultData[];
  isLoading: boolean;
  error: string | null;
  isNotesLoading: boolean;
  fetchCallDetail: (callId: string) => Promise<void>;
  reset: () => void;
  fetchCallNotes: (callId: string) => Promise<void>;
  addNote: (callId: string, note: string, userId: string, latitude: number | null, longitude: number | null) => Promise<void>;
  searchNotes: (query: string) => CallNoteResultData[];
  callImages: CallFileResultData[] | null;
  callFiles: CallFileResultData[] | null;
  isLoadingFiles: boolean;
  errorFiles: string | null;
  fetchCallFiles: (callId: string) => Promise<void>;
  isLoadingImages: boolean;
  errorImages: string | null;
  fetchCallImages: (callId: string) => Promise<void>;
  callAudio: CallFileResultData[] | null;
  isLoadingAudio: boolean;
  errorAudio: string | null;
  fetchCallAudio: (callId: string) => Promise<void>;
  uploadCallImage: (callId: string, userId: string, note: string, name: string, latitude: number | null, longitude: number | null, file: string) => Promise<void>;
  updateCall: (callData: UpdateCallRequest) => Promise<void>;
  closeCall: (callData: CloseCallRequest) => Promise<void>;
  deleteCall: (callId: string) => Promise<void>;
  rescheduleDispatchTime: (callId: string, date: string) => Promise<void>;
}

export const useCallDetailStore = create<CallDetailState>((set, get) => ({
  call: null,
  callExtraData: null,
  callPriority: null,
  callNotes: [],
  isLoading: false,
  error: null,
  isNotesLoading: false,
  callImages: null,
  isLoadingImages: false,
  errorImages: null,
  callFiles: null,
  isLoadingFiles: false,
  errorFiles: null,
  callAudio: null,
  isLoadingAudio: false,
  errorAudio: null,
  reset: () =>
    set({
      call: null,
      callExtraData: null,
      callPriority: null,
      isLoading: false,
      isNotesLoading: false,
      error: null,
    }),
  fetchCallDetail: async (callId: string) => {
    set({ isLoading: true, error: null });
    try {
      const [callResult, callExtraDataResult] = await Promise.all([getCall(callId), getCallExtraData(callId)]);

      if (callResult && callResult.Data && callExtraDataResult && callExtraDataResult.Data) {
        const callPriority = useCallsStore.getState().callPriorities.find((priority) => priority.Id === callResult.Data.Priority);

        set({
          call: callResult.Data,
          callExtraData: callExtraDataResult.Data,
          callPriority: callPriority || null,
          isLoading: false,
        });
      } else {
        set({
          error: callResult?.Message || 'Failed to fetch call details',
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        isLoading: false,
      });
    }
  },
  fetchCallNotes: async (callId: string) => {
    set({ isNotesLoading: true });
    try {
      const callNotes = await getCallNotes(callId);
      set({
        callNotes: callNotes.Data || [],
        isNotesLoading: false,
      });
    } catch (error) {
      set({
        callNotes: [],
        isNotesLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch call notes',
      });
    }
  },
  addNote: async (callId: string, note: string, userId: string, latitude: number | null, longitude: number | null) => {
    set({ isNotesLoading: true });
    try {
      await saveCallNote(callId, userId, note, latitude, longitude);
      await get().fetchCallNotes(callId);
    } catch (error) {
      set({
        isNotesLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add note',
      });
    }
  },
  searchNotes: (query: string): CallNoteResultData[] => {
    const callNotes = get().callNotes;
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return callNotes;
    return callNotes?.filter((note: CallNoteResultData) => note.Note.toLowerCase().includes(trimmedQuery.toLowerCase()) || note.FullName.toLowerCase().includes(trimmedQuery.toLowerCase()));
  },
  fetchCallImages: async (callId: string) => {
    set({ isLoadingImages: true, errorImages: null });
    try {
      const callImages = await getCallImages(callId, false);
      set({
        callImages: callImages.Data || [],
        isLoadingImages: false,
      });
    } catch (error) {
      set({
        callImages: [],
        isLoadingImages: false,
        errorImages: error instanceof Error ? error.message : 'Failed to fetch call images',
      });
    }
  },
  uploadCallImage: async (callId: string, userId: string, note: string, name: string, latitude: number | null, longitude: number | null, file: string) => {
    try {
      await saveCallImage(callId, userId, note, name, latitude, longitude, file);

      // After successful upload, refresh the images list
      useCallDetailStore.getState().fetchCallImages(callId);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },
  fetchCallFiles: async (callId: string) => {
    set({ isLoadingFiles: true, errorFiles: null });
    try {
      const callFiles = await getCallFiles(callId, false);
      set({
        callFiles: callFiles.Data || [],
        isLoadingFiles: false,
      });
    } catch (error) {
      set({
        callFiles: [],
        isLoadingFiles: false,
        errorFiles: error instanceof Error ? error.message : 'Failed to fetch call files',
      });
    }
  },
  fetchCallAudio: async (callId: string) => {
    set({ isLoadingAudio: true, errorAudio: null });
    try {
      const callAudio = await getCallAudio(callId, false);
      set({
        callAudio: callAudio.Data || [],
        isLoadingAudio: false,
      });
    } catch (error) {
      set({
        callAudio: [],
        isLoadingAudio: false,
        errorAudio: error instanceof Error ? error.message : 'Failed to fetch call audio',
      });
    }
  },
  updateCall: async (callData: UpdateCallRequest) => {
    set({ isLoading: true, error: null });
    try {
      await updateCall(callData);
      // Refresh call details after successful update
      await get().fetchCallDetail(callData.callId);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update call',
        isLoading: false,
      });
      throw error;
    }
  },
  closeCall: async (callData: CloseCallRequest) => {
    set({ isLoading: true, error: null });
    try {
      await closeCall(callData);
      // After closing, just set loading to false
      // The calling component will handle navigation
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to close call',
        isLoading: false,
      });
      throw error;
    }
  },
  deleteCall: async (callId: string) => {
    set({ isLoading: true, error: null });
    try {
      await deleteCall(callId);
      // The calling component handles list refresh + navigation.
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete call',
        isLoading: false,
      });
      throw error;
    }
  },
  rescheduleDispatchTime: async (callId: string, date: string) => {
    set({ isLoading: true, error: null });
    try {
      await updateScheduledDispatchTime({ callId, date });
      // Refresh the call so the new scheduled time is reflected.
      await get().fetchCallDetail(callId);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to reschedule call',
        isLoading: false,
      });
      throw error;
    }
  },
}));
