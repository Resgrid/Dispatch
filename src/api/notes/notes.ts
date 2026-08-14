import { type NoteCategoryResult } from '@/models/v4/notes/noteCategoryResult';
import { type NoteResult } from '@/models/v4/notes/noteResult';
import { type NotesResult } from '@/models/v4/notes/notesResult';
import { type SaveNoteInput } from '@/models/v4/notes/saveNoteInput';
import { type SaveNoteResult } from '@/models/v4/notes/saveNoteResult';

import { createCachedApiEndpoint } from '../common/cached-client';
import { createApiEndpoint } from '../common/client';

const getAllNotesApi = createCachedApiEndpoint('/Notes/GetAllNotes', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

const getDispatchNoteApi = createCachedApiEndpoint('/Notes/GetDispatchNote', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

const getNoteCategoriesApi = createCachedApiEndpoint('/Notes/GetNoteCategories', {
  ttl: 15 * 60 * 1000, // Cache for 15 minutes -- operational data, must not go stale
  enabled: true,
});

const getAllUnexpiredNotesByCategoryApi = createApiEndpoint('/Notes/GetAllUnexpiredNotesByCategory');

const getNoteApi = createApiEndpoint('/Notes/GetNote');

const saveNoteApi = createApiEndpoint('/Notes/SaveNote');

export const getAllNotes = async () => {
  const response = await getAllNotesApi.get<NotesResult>();
  return response.data;
};

export const getDispatchNote = async () => {
  const response = await getDispatchNoteApi.get<NotesResult>();
  return response.data;
};

export const getAllUnexpiredNotesByCategory = async (category: string, includeUnCategorized: boolean) => {
  const response = await getAllUnexpiredNotesByCategoryApi.get<NotesResult>({
    category: category,
    includeUnCategorized: includeUnCategorized,
  });
  return response.data;
};

export const getNote = async (noteId: string) => {
  const response = await getNoteApi.get<NoteResult>({
    noteId: noteId,
  });
  return response.data;
};

export const getNoteCategories = async () => {
  const response = await getNoteCategoriesApi.get<NoteCategoryResult>();
  return response.data;
};

export const saveNote = async (data: SaveNoteInput) => {
  const response = await saveNoteApi.post<SaveNoteResult>({
    ...data,
  });
  return response.data;
};
