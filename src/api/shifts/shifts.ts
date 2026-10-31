/**
 * Shifts API Module
 * Provides API functions for shift operations
 */

import { type ShiftDayResult } from '@/models/v4/shifts/shiftDayResult';
import { type ShiftDaysResult } from '@/models/v4/shifts/shiftDaysResult';
import { type ShiftResult } from '@/models/v4/shifts/shiftResult';
import { type ShiftsResult } from '@/models/v4/shifts/shiftsResult';
import { type SignupShiftDayResult } from '@/models/v4/shifts/signupShiftDayResult';

import { createApiEndpoint } from '../common/client';

const getAllShiftsApi = createApiEndpoint('/Shifts/GetShifts');
const getShiftApi = createApiEndpoint('/Shifts/GetShift');
const getShiftDayApi = createApiEndpoint('/Shifts/GetShiftDay');
const getTodaysShiftsApi = createApiEndpoint('/Shifts/GetTodaysShifts');
const signupForShiftDayApi = createApiEndpoint('/Shifts/SignupForShiftDay');

/**
 * Result ids are strings, but the POST inputs bind numeric ids.
 */
const toNumericId = (id: string | number): number => (typeof id === 'number' ? id : Number.parseInt(id, 10));

/**
 * Get all shifts
 */
export const getAllShifts = async (): Promise<ShiftsResult> => {
  const response = await getAllShiftsApi.get<ShiftsResult>();
  return response.data;
};

/**
 * Get a specific shift by ID
 */
export const getShift = async (shiftId: string): Promise<ShiftResult> => {
  const response = await getShiftApi.get<ShiftResult>({ id: shiftId });
  return response.data;
};

/**
 * Get shift day information
 */
export const getShiftDay = async (shiftDayId: string): Promise<ShiftDayResult> => {
  const response = await getShiftDayApi.get<ShiftDayResult>({ id: shiftDayId });
  return response.data;
};

/**
 * Get today's shifts
 */
export const getTodaysShifts = async (): Promise<ShiftDaysResult> => {
  const response = await getTodaysShiftsApi.get<ShiftDaysResult>();
  return response.data;
};

/**
 * Sign the current user up for a shift day; the server requires the group (team) the signup is under.
 */
export const signupForShiftDay = async (shiftDayId: string, groupId: string): Promise<SignupShiftDayResult> => {
  const response = await signupForShiftDayApi.post<SignupShiftDayResult>({
    ShiftDayId: toNumericId(shiftDayId),
    GroupId: toNumericId(groupId),
  });
  return response.data;
};
