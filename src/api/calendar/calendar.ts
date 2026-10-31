/**
 * Calendar API Module
 * Provides API functions for calendar operations
 */

import { type CalendarItemResult } from '@/models/v4/calendar/calendarItemResult';
import { type CalendarItemsResult } from '@/models/v4/calendar/calendarItemsResult';
import { type CalendarItemTypesResult } from '@/models/v4/calendar/calendarItemTypesResult';
import { type SetCalendarAttendingResult } from '@/models/v4/calendar/setCalendarAttendingResult';

import { createApiEndpoint } from '../common/client';

const calendarApi = createApiEndpoint('/Calendar/GetDepartmentCalendarItems');
const calendarItemApi = createApiEndpoint('/Calendar/GetCalendarItem');
const calendarItemTypesApi = createApiEndpoint('/Calendar/GetDepartmentCalendarItemTypes');
const calendarItemsForDateRangeApi = createApiEndpoint('/Calendar/GetDepartmentCalendarItemsInRange');
const setCalendarAttendingApi = createApiEndpoint('/Calendar/SetCalendarAttendingStatus');

/**
 * Get all calendar items
 */
export const getCalendarItems = async (): Promise<CalendarItemsResult> => {
  const response = await calendarApi.get<CalendarItemsResult>();
  return response.data;
};

/**
 * Get a specific calendar item by ID
 */
export const getCalendarItem = async (itemId: string): Promise<CalendarItemResult> => {
  const response = await calendarItemApi.get<CalendarItemResult>({ id: itemId });
  return response.data;
};

/**
 * Get calendar item types
 */
export const getCalendarItemTypes = async (): Promise<CalendarItemTypesResult> => {
  const response = await calendarItemTypesApi.get<CalendarItemTypesResult>();
  return response.data;
};

/**
 * Get calendar items for a specific date range
 */
export const getCalendarItemsForDateRange = async (startDate: string, endDate: string): Promise<CalendarItemsResult> => {
  const response = await calendarItemsForDateRangeApi.get<CalendarItemsResult>({
    start: startDate,
    end: endDate,
  });
  return response.data;
};

/**
 * Set calendar attendance (Type 1 = attending, 4 = not attending)
 */
export const setCalendarAttending = async ({ calendarItemId, attending, note }: { calendarItemId: string; attending: boolean; note?: string }): Promise<void> => {
  await setCalendarAttendingApi.post<SetCalendarAttendingResult>({
    CalendarEventId: calendarItemId,
    Type: attending === true ? 1 : 4,
    Note: note || '',
  });
};
