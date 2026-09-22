import {
  type ContactHazardsResult,
  type ContactPreplanResult,
  type DeleteContactHazardResult,
  type DeleteContactPreplanResult,
  type SaveContactHazardInput,
  type SaveContactHazardResult,
  type SaveContactPreplanInput,
  type SaveContactPreplanResult,
} from '@/models/v4/contacts/contactPreplanResult';

import { createApiEndpoint } from '../common/client';

// v4 Contacts pre-plan and hazard endpoints (Contacts plan Phase A, A5). Reads need Contacts_View,
// writes Contacts_Update. The client attaches the Protected Data Grant header automatically; without
// one, a protected department's text fields come back REDACTED with RedactedFields naming them.

const getContactPreplanApi = createApiEndpoint('/Contacts/GetContactPreplan');
const saveContactPreplanApi = createApiEndpoint('/Contacts/SaveContactPreplan');
const deleteContactPreplanApi = createApiEndpoint('/Contacts/DeleteContactPreplan');
const getContactHazardsApi = createApiEndpoint('/Contacts/GetContactHazards');
const saveContactHazardApi = createApiEndpoint('/Contacts/SaveContactHazard');
const deleteContactHazardApi = createApiEndpoint('/Contacts/DeleteContactHazard');

export const getContactPreplan = async (contactId: string, signal?: AbortSignal) => {
  const response = await getContactPreplanApi.get<ContactPreplanResult>({ contactId }, signal);
  return response.data;
};

export const saveContactPreplan = async (input: SaveContactPreplanInput) => {
  const response = await saveContactPreplanApi.post<SaveContactPreplanResult>({ ...input });
  return response.data;
};

export const deleteContactPreplan = async (contactId: string) => {
  const response = await deleteContactPreplanApi.delete<DeleteContactPreplanResult>({ contactId });
  return response.data;
};

export const getContactHazards = async (contactId: string, signal?: AbortSignal) => {
  const response = await getContactHazardsApi.get<ContactHazardsResult>({ contactId }, signal);
  return response.data;
};

export const saveContactHazard = async (input: SaveContactHazardInput) => {
  const response = await saveContactHazardApi.post<SaveContactHazardResult>({ ...input });
  return response.data;
};

export const deleteContactHazard = async (contactPreplanHazardId: string) => {
  const response = await deleteContactHazardApi.delete<DeleteContactHazardResult>({ contactPreplanHazardId });
  return response.data;
};
