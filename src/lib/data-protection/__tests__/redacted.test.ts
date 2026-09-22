import { isFieldRedacted, isRedactedValue, ProtectedFieldIds, REDACTION_VALUE } from '@/lib/data-protection/redacted';

/**
 * Which signal wins matters. The server's RedactedFields list is authoritative; the sentinel value
 * is only a fallback, because a member can legitimately type "REDACTED" into a note and masking
 * their own words is a bug they cannot explain or work around.
 */
describe('isFieldRedacted', () => {
  it('trusts the field list over the value', () => {
    expect(isFieldRedacted([ProtectedFieldIds.callName], ProtectedFieldIds.callName, 'Structure Fire')).toBe(true);
    expect(isFieldRedacted([ProtectedFieldIds.callNotes], ProtectedFieldIds.callName, REDACTION_VALUE)).toBe(false);
  });

  it('does not mask a member who typed the sentinel themselves', () => {
    // A list is present and does not name this field, so the value is beside the point.
    expect(isFieldRedacted([ProtectedFieldIds.callNotes], ProtectedFieldIds.callName, 'REDACTED')).toBe(false);
  });

  it('falls back to the value only when no list came with the payload', () => {
    expect(isFieldRedacted(undefined, ProtectedFieldIds.callName, REDACTION_VALUE)).toBe(true);
    expect(isFieldRedacted(null, ProtectedFieldIds.callName, 'Structure Fire')).toBe(false);
  });

  it('trusts an explicitly empty list over the sentinel', () => {
    // [] is the server saying nothing was withheld. Sniffing the value anyway would re-mask a
    // member who legitimately typed REDACTED, which is the false positive the list prevents.
    expect(isFieldRedacted([], ProtectedFieldIds.callName, REDACTION_VALUE)).toBe(false);
  });

  it('matches field ids case-insensitively', () => {
    // The catalog is lowercase but a serializer between here and there may not be.
    expect(isFieldRedacted(['Calls.Name'], ProtectedFieldIds.callName, 'x')).toBe(true);
  });

  it('survives a malformed list without throwing', () => {
    expect(isFieldRedacted([null as unknown as string], ProtectedFieldIds.callName, 'x')).toBe(false);
  });

  it('reads a plain value only on exact match', () => {
    expect(isRedactedValue(REDACTION_VALUE)).toBe(true);
    expect(isRedactedValue('redacted')).toBe(false);
    expect(isRedactedValue('REDACTED ')).toBe(false);
    expect(isRedactedValue(null)).toBe(false);
    expect(isRedactedValue(undefined)).toBe(false);
  });
});
