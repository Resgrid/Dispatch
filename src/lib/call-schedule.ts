/**
 * Scheduled dispatch ("dispatch on") for the call screens: the API sends and takes it as a UTC instant
 * (`DispatchOnUtc` on save and edit, `DispatchedOnUtc` on the call), and the picker works in the same
 * ISO form.
 */

/**
 * A scheduled dispatch must be at least this far ahead, the same rule as the web form. Anything sooner
 * is a dispatch now, which the dispatcher should do without a schedule.
 */
export const MIN_DISPATCH_LEAD_MINUTES = 15;

const MIN_DISPATCH_LEAD_MS = MIN_DISPATCH_LEAD_MINUTES * 60 * 1000;

/** A UTC timestamp from the API or the picker. One without a zone is UTC: the API leaves the 'Z' off. */
export const parseUtcTimestamp = (value?: string | null): Date | null => {
  const text = value?.trim();

  if (!text) {
    return null;
  }

  const parsed = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) ? text : `${text}Z`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** The `DispatchOnUtc` wire value for a picked time, or undefined when none was picked (send nothing). */
export const toDispatchOnUtc = (value?: string | null): string | undefined => parseUtcTimestamp(value)?.toISOString();

/** True when a picked dispatch time is less than {@link MIN_DISPATCH_LEAD_MINUTES} away (or already past). */
export const isDispatchTimeTooSoon = (value: string | null | undefined, now: number = Date.now()): boolean => {
  const time = parseUtcTimestamp(value);

  return !!time && time.getTime() < now + MIN_DISPATCH_LEAD_MS;
};

/**
 * What the edit screen's dispatch time starts as: the call's stored dispatch time while it is still
 * ahead (a scheduled call), otherwise empty — a call that already went out has nothing to reschedule.
 */
export const getScheduledDispatchPrefill = (dispatchedOnUtc: string | null | undefined, now: number = Date.now()): string => {
  const time = parseUtcTimestamp(dispatchedOnUtc);

  return time && time.getTime() > now ? time.toISOString() : '';
};
