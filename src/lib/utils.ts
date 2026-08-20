import * as he from 'he';
import { Linking } from 'react-native';
import { Platform } from 'react-native';
import type { StoreApi, UseBoundStore } from 'zustand';

import { Env } from './env';
import { getBaseApiUrl } from './storage/app';

/**
 * Call State Constants
 * API returns numeric state values:
 * 0 = Active, 1 = Open, 2 = Pending, 3 = Scheduled, 4 = Closed
 */
export const CallState = {
  ACTIVE: 0,
  OPEN: 1,
  PENDING: 2,
  SCHEDULED: 3,
  CLOSED: 4,
} as const;

/**
 * Check if a call state represents an active/open call
 * Handles both numeric (0, 1) and string ('Active', 'Open', '0', '1') values
 */
export function isCallActive(state: number | string | undefined | null): boolean {
  if (state === null || state === undefined) return false;

  // Check numeric values
  if (typeof state === 'number') {
    return state === CallState.ACTIVE || state === CallState.OPEN;
  }

  // Check string values (case-insensitive)
  const stateStr = String(state).toLowerCase().trim();
  return stateStr === 'active' || stateStr === 'open' || stateStr === '0' || stateStr === '1';
}

/**
 * Check if a call state represents a pending call
 */
export function isCallPending(state: number | string | undefined | null): boolean {
  if (state === null || state === undefined) return false;

  if (typeof state === 'number') {
    return state === CallState.PENDING;
  }

  const stateStr = String(state).toLowerCase().trim();
  return stateStr === 'pending' || stateStr === '2';
}

/**
 * Check if a call state represents a scheduled call
 */
export function isCallScheduled(state: number | string | undefined | null): boolean {
  if (state === null || state === undefined) return false;

  if (typeof state === 'number') {
    return state === CallState.SCHEDULED;
  }

  const stateStr = String(state).toLowerCase().trim();
  return stateStr === 'scheduled' || stateStr === '3';
}

/**
 * Check if a call state represents a closed call
 */
export function isCallClosed(state: number | string | undefined | null): boolean {
  if (state === null || state === undefined) return false;

  if (typeof state === 'number') {
    return state === CallState.CLOSED;
  }

  const stateStr = String(state).toLowerCase().trim();
  return stateStr === 'closed' || stateStr === '4';
}

export function openLinkInBrowser(url: string) {
  Linking.canOpenURL(url).then((canOpen) => canOpen && Linking.openURL(url));
}

type WithSelectors<S> = S extends { getState: () => infer T } ? S & { use: { [K in keyof T]: () => T[K] } } : never;

export const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(_store: S) => {
  let store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (let k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

export const IS_ANDROID = Platform.OS === 'android';
export const IS_IOS = Platform.OS === 'ios';
export const DEFAULT_CENTER_COORDINATE = [-77.036086, 38.910233];
export const SF_OFFICE_COORDINATE = [-122.400021, 37.789085];

export function onSortOptions(a: any, b: any) {
  if (a.label < b.label) {
    return -1;
  }

  if (a.label > b.label) {
    return 1;
  }

  return 0;
}

export function getAvatarUrl(userId: string) {
  return getBaseApiUrl() + '/Avatars/Get?id=' + userId;
}

export function invertColor(hex: string, bw: boolean): string {
  if (!hex) {
    return '#000000';
  }
  if (hex.indexOf('#') === 0) {
    hex = hex.slice(1);
  }
  // convert 3-digit hex to 6-digits.
  if (hex.length === 3) {
    const h0 = hex[0];
    const h1 = hex[1];
    const h2 = hex[2];
    if (h0 && h1 && h2) {
      hex = h0 + h0 + h1 + h1 + h2 + h2;
    }
  }
  // strip alpha channel from 8-digit hex.
  if (hex.length === 8) {
    hex = hex.slice(0, 6);
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return '#000000';
  }
  let r = parseInt(hex.slice(0, 2), 16),
    g = parseInt(hex.slice(2, 4), 16),
    b = parseInt(hex.slice(4, 6), 16);
  if (bw) {
    // https://stackoverflow.com/a/3943023/112731
    return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000000' : '#FFFFFF';
  }
  // invert color components
  let r2 = (255 - r).toString(16),
    g2 = (255 - g).toString(16),
    b2 = (255 - b).toString(16);
  // pad each with zeros and return
  return '#' + padZero(r2, 2) + padZero(g2, 2) + padZero(b2, 2);
}

export function padZero(str: string, len: number): string {
  len = len || 2;
  var zeros = new Array(len).join('0');
  return (zeros + str).slice(-len);
}

export function toRgbaWithAlpha(color: string, alpha: number): string {
  const a = Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
  if (!color) return `rgba(0, 0, 0, ${a})`;

  const clamp = (n: number) => (Number.isFinite(n) ? Math.min(255, Math.max(0, n)) : 0);
  const trimmed = color.trim();

  // hex: #RGB, #RRGGBB, #RRGGBBAA
  if (trimmed.startsWith('#')) {
    let hex = trimmed.slice(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length >= 6) {
      const r = clamp(parseInt(hex.slice(0, 2), 16));
      const g = clamp(parseInt(hex.slice(2, 4), 16));
      const b = clamp(parseInt(hex.slice(4, 6), 16));
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const r = clamp(Number(rgbMatch[1]));
    const g = clamp(Number(rgbMatch[2]));
    const b = clamp(Number(rgbMatch[3]));
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return trimmed;
}

export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Strips HTML tags and elements from a text string
 * @param html The HTML string to be stripped
 * @returns Plain text with all HTML tags removed
 */
export function stripHtmlTags(html: string): string {
  if (!html) return '';

  // Decode all HTML entities first using 'he' library
  const decoded = he.decode(html, { isAttributeValue: false });

  // Remove HTML tags from the decoded string
  const withoutTags = decoded.replace(/<[^>]*>/g, '');

  return withoutTags.trim();
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function to2Digit(str: string): string {
  if (!str) {
    return '';
  }

  const isString: boolean = typeof str === 'string';
  if (isString && str.length === 1) {
    str = 0 + str;
  }
  return str;
}

export function getMinutesBetweenDates(startDate: Date, endDate: Date): number {
  let diff = endDate.getTime() - startDate.getTime();
  return diff / 60000;
}

export function parseDateISOString(s: string | undefined | null): Date | null {
  if (!s) {
    return null;
  }
  const b = s.split(/\D/);
  // Ensure we have all required parts
  const [year, month, day, hour = '0', minute = '0', second = '0'] = b;
  if (!year || !month || !day) {
    return null;
  }
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hour, 10), parseInt(minute, 10), parseInt(second, 10));
  if (isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function getDate(date: string): string {
  if (!date) {
    return 'Unknown';
  }

  const d = new Date(date);
  const datestring = ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + d.getFullYear() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);

  return datestring;
}

export function formatDateForDisplay(date: Date | null, format: string): string {
  // Original idea from: https://weblog.west-wind.com/posts/2008/Mar/18/A-simple-formatDate-function-for-JavaScript

  if (!date) {
    return '';
  }

  if (!format) {
    format = 'MM/dd/yyyy';
  }

  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  let hours = date.getHours();
  if (format.indexOf('t') > -1) {
    if (hours > 11) {
      format = format.replace('t', 'pm');
    } else {
      format = format.replace('t', 'am');
    }
  }

  if (format.indexOf('MMMM') > -1) {
    const monthName = monthNames[date.getMonth()];
    if (monthName) {
      format = format.replace('MMMM', monthName);
    }
  } else if (format.indexOf('MMM') > -1) {
    const shortMonthName = monthShortNames[date.getMonth()];
    if (shortMonthName) {
      format = format.replace('MMM', shortMonthName);
    }
  } else if (format.indexOf('MM') > -1) {
    format = format.replace('MM', padLeadingZero(month).toString());
  }

  if (format.indexOf('yyyy') > -1) {
    format = format.replace('yyyy', year.toString());
  } else if (format.indexOf('yy') > -1) {
    format = format.replace('yy', year.toString().substr(2, 2));
  }

  format = format.replace('dd', padLeadingZero(date.getDate()).toString());

  if (format.indexOf('HH') > -1) {
    format = format.replace('HH', padLeadingZero(hours).toString());
  }

  if (format.indexOf('hh') > -1) {
    if (hours > 12) {
      hours = hours - 12;
    }

    if (hours === 0) {
      hours = hours = 12;
    }
    format = format.replace('hh', padLeadingZero(hours).toString());
  }
  if (format.indexOf('mm') > -1) {
    format = format.replace('mm', padLeadingZero(date.getMinutes()).toString());
  }

  if (format.indexOf('ss') > -1) {
    format = format.replace('ss', padLeadingZero(date.getSeconds()).toString());
  }
  if (format.indexOf('Z') > -1) {
    let timeZone: string | undefined;
    try {
      // Chrome, Firefox
      let zone = /.*\s(.+)/.exec(
        new Date()?.toLocaleDateString(navigator.language, {
          timeZoneName: 'short',
        })
      );
      if (zone) {
        timeZone = zone[1];
      }
    } catch (e) {
      // IE, some loss in accuracy due to guessing at the abbreviation
      // Note: This regex adds a grouping around the open paren as a
      //       workaround for an IE regex parser bug
      timeZone = new Date().toTimeString()?.match(new RegExp('[A-Z](?!.*[(])', 'g'))?.join('');
    }

    if (timeZone) {
      format = format.replace('Z', timeZone);
    }
  }

  return format;
}

/**
 * Format a date to YYYY-MM-DD string in local timezone
 * This prevents timezone conversion issues when working with calendar dates
 */
export function formatLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as a local date string (YYYY-MM-DD)
 * This ensures we get the current date in the user's timezone
 */
export function getTodayLocalString(): string {
  return formatLocalDateString(new Date());
}

export function isSameDate(date1: string | Date, date2: string | Date): boolean {
  // Helper function to create a date from string, handling date-only strings as local dates
  const createDate = (date: string | Date): Date => {
    if (date instanceof Date) {
      return date;
    }

    // If it's a date-only string (YYYY-MM-DD), treat it as local date
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parts = date.split('-');
      const year = parseInt(parts[0] ?? '0', 10);
      const month = parseInt(parts[1] ?? '0', 10);
      const day = parseInt(parts[2] ?? '0', 10);
      if (year && month && day) {
        return new Date(year, month - 1, day); // Month is 0-indexed
      }
    }

    // Otherwise, parse as usual (handles ISO strings with time)
    return new Date(date);
  };

  const d1 = createDate(date1);
  const d2 = createDate(date2);

  // Use local date methods for comparison to match user's timezone context
  // This ensures calendar items appear on the correct day as intended by the backend
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

export function isToday(date: string | Date): boolean {
  return isSameDate(date, new Date());
}

export function formatDateString(date: Date): string {
  const day = date.getDate(); // yields date
  const month = date.getMonth() + 1; // yields month (add one as '.getMonth()' is zero indexed)
  const year = date.getFullYear(); // yields year
  const hour = date.getHours(); // yields hours
  const minute = date.getMinutes(); // yields minutes
  const second = date.getSeconds(); // yields seconds
  let timeZone = '';

  /*
      try {
          // Chrome, Firefox
          timeZone = /.*\s(.+)/.exec((new Date()).toLocaleDateString(navigator.language, { timeZoneName:'short' }))[1];
      } catch(e) {
          // IE, some loss in accuracy due to guessing at the abbreviation
          // Note: This regex adds a grouping around the open paren as a
          //       workaround for an IE regex parser bug
          timeZone = (new Date()).toTimeString().match(new RegExp('[A-Z](?!.*[\(])','g')).join('');
      }
      */

  timeZone = createDateUTCOffset(date);

  const time = padLeadingZero(month) + '/' + padLeadingZero(day) + '/' + year + ' ' + padLeadingZero(hour) + ':' + padLeadingZero(minute) + ':' + padLeadingZero(second) + ' ' + timeZone;

  return time;
}

export function padLeadingZero(value: number): string {
  return value < 10 ? '0' + value : value.toString();
}

export function createDateUTCOffset(date: Date): string {
  const sign = date.getTimezoneOffset() > 0 ? '-' : '+';
  const offset = Math.abs(date.getTimezoneOffset());
  const hours = padLeadingZero(Math.floor(offset / 60));
  const minutes = padLeadingZero(offset % 60);
  return sign + hours + ':' + minutes;
}

export function addDaysToDate(date: string, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function subtractDaysFromDate(date: string, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

export function getTimeAgo(time: any, floor: number = 0): string {
  if (!time) {
    return 'Unknown';
  }

  switch (typeof time) {
    case 'number':
      break;
    case 'string':
      time = +new Date(time);
      break;
    case 'object':
      if (time.constructor === Date) {
        time = time.getTime();
      }
      break;
    default:
      time = +new Date();
  }

  if (typeof time !== 'number' || isNaN(time)) {
    return 'Unknown';
  }

  const timeFormats = [
    [60, 'seconds', 1], // 60
    [120, '1 minute ago', '1 minute from now'], // 60*2
    [3600, 'minutes', 60], // 60*60, 60
    [7200, '1 hour ago', '1 hour from now'], // 60*60*2
    [86400, 'hours', 3600], // 60*60*24, 60*60
    [172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
    [604800, 'days', 86400], // 60*60*24*7, 60*60*24
    [1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
    [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
    [4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
    [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
    [58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
    [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
    [5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
    [58060800000, 'centuries', 2903040000], // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
  ];
  let seconds = (+new Date() - time) / 1000,
    token = 'ago',
    listChoice = 1;

  if (floor > 0 && seconds < floor) {
    seconds = seconds + floor;
  }

  if (seconds === 0) {
    return 'Just now';
  }
  if (seconds < 0) {
    seconds = Math.abs(seconds);
    token = 'from now';
    listChoice = 2;
  }
  let i = 0,
    format;
  while ((format = timeFormats[i++])) {
    if (seconds < Number(format[0])) {
      if (typeof format[2] === 'string') {
        const formattedValue = format[listChoice];
        return formattedValue ? formattedValue.toString() : time.toString();
      } else {
        const unit = format[1];
        const divisor = format[2];
        if (unit && divisor) {
          return Math.floor(seconds / divisor) + ' ' + unit + ' ' + token;
        }
      }
    }
  }
  return time.toString();
}

export function getTimeAgoUtc(time: any): string {
  if (!time) {
    return 'Unknown';
  }

  // Legacy API values are zone-less UTC strings that new Date() parses as device-local time;
  // those need "now" shifted by the same offset below. Strings carrying an explicit Z/±hh:mm
  // designator parse correctly and must not be shifted.
  let hasZone = false;

  switch (typeof time) {
    case 'number':
      // Epoch milliseconds are an exact instant — never shift.
      hasZone = true;
      break;
    case 'string':
      hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(time.trim());
      time = +new Date(time);
      break;
    case 'object':
      if (time instanceof Date) {
        // A Date is an exact instant — never shift.
        hasZone = true;
        time = time.getTime();
      }
      break;
    default:
      hasZone = true;
      time = +new Date();
  }

  if (typeof time !== 'number' || isNaN(time)) {
    return 'Unknown';
  }

  const currentDate = new Date();
  time = Number(new Date(time).getTime() + 0 * 60 * 1000);

  const timeFormats = [
    [60, 'seconds', 1], // 60
    [120, '1 minute ago', '1 minute from now'], // 60*2
    [3600, 'minutes', 60], // 60*60, 60
    [7200, '1 hour ago', '1 hour from now'], // 60*60*2
    [86400, 'hours', 3600], // 60*60*24, 60*60
    [172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
    [604800, 'days', 86400], // 60*60*24*7, 60*60*24
    [1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
    [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
    [4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
    [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
    [58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
    [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
    [5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
    [58060800000, 'centuries', 2903040000], // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
  ];
  const nowMs = hasZone ? currentDate.getTime() : currentDate.getTime() + currentDate.getTimezoneOffset() * 60 * 1000;
  let seconds = (nowMs - time) / 1000,
    token = 'ago',
    listChoice = 1;

  if (seconds === 0) {
    return 'Just now';
  }
  if (seconds < 0) {
    seconds = Math.abs(seconds);
    token = 'from now';
    listChoice = 2;
  }
  let i = 0,
    format;
  while ((format = timeFormats[i++])) {
    if (seconds < Number(format[0])) {
      if (typeof format[2] === 'string') {
        const formattedValue = format[listChoice];
        return formattedValue ? formattedValue.toString() : time.toString();
      } else {
        const unit = format[1];
        const divisor = format[2];
        if (unit && divisor) {
          return Math.floor(seconds / divisor) + ' ' + unit + ' ' + token;
        }
      }
    }
  }
  return time.toString();
}
