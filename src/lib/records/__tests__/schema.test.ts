import {
  canAuthorOffline,
  cellKey,
  evaluateRules,
  isFieldHidden,
  isFieldRequired,
  isSupportedField,
  rowKeysFor,
  toValueList,
  toValueMap,
  unsupportedFieldKeys,
  validate,
  type ValueMap,
} from '@/lib/records/schema';
import { RmsFieldType } from '@/models/v4/records';

import { GOLDEN_SCHEMA, goldenCatalogEntry, UNSUPPORTED_SCHEMA } from './fixtures';

// Shared conformance suite for the Field Records renderer (RMS plan RMS-1D). This file is identical
// in all four app repositories: every adapter must agree on what is shown, what is required, and
// what is refused, whatever its presentation looks like.

const set = (values: ValueMap, sectionKey: string, fieldKey: string, value: string, rowKey: string | null = null): ValueMap => ({
  ...values,
  [cellKey(sectionKey, fieldKey, rowKey)]: { SectionKey: sectionKey, FieldKey: fieldKey, RowKey: rowKey, Value: value },
});

describe('Field Records schema conformance', () => {
  it('renders every control the contract names, and refuses the ones it cannot draw', () => {
    for (const section of GOLDEN_SCHEMA.Sections) {
      for (const field of section.Fields) {
        expect(isSupportedField(field)).toBe(true);
      }
    }

    expect(unsupportedFieldKeys(GOLDEN_SCHEMA)).toEqual([]);
    expect(unsupportedFieldKeys(UNSUPPORTED_SCHEMA)).toEqual(['future']);
  });

  it('shows and requires fields from the values, matching the server rules', () => {
    let values: ValueMap = {};

    let rules = evaluateRules(GOLDEN_SCHEMA, values);
    expect(isFieldHidden(rules, 'summary', 'incomplete_reason')).toBe(true);
    expect(isFieldRequired(rules, GOLDEN_SCHEMA.Sections[0].Fields.find((f) => f.Key === 'destination')!, 'summary')).toBe(false);

    values = set(values, 'summary', 'outcome', 'incomplete');
    values = set(values, 'summary', 'was_transported', 'true');
    rules = evaluateRules(GOLDEN_SCHEMA, values);

    expect(isFieldHidden(rules, 'summary', 'incomplete_reason')).toBe(false);
    expect(isFieldRequired(rules, GOLDEN_SCHEMA.Sections[0].Fields.find((f) => f.Key === 'destination')!, 'summary')).toBe(true);
  });

  it('evaluates a rule inside a repeating section against that row only', () => {
    let values: ValueMap = {};
    values = set(values, 'crew', 'role', 'driver', 'row-1');
    values = set(values, 'crew', 'role', 'officer', 'row-2');

    const rules = evaluateRules(GOLDEN_SCHEMA, values);

    expect(rowKeysFor(values, 'crew')).toEqual(['row-1', 'row-2']);
    expect(isFieldHidden(rules, 'crew', 'driver_note', 'row-1')).toBe(false);
    expect(isFieldHidden(rules, 'crew', 'driver_note', 'row-2')).toBe(true);
  });

  it('reports required, range and length problems without blocking on hidden fields', () => {
    let values: ValueMap = {};
    values = set(values, 'summary', 'people_count', '900');

    const issues = validate(GOLDEN_SCHEMA, values, false);

    expect(issues.some((issue) => issue.fieldKey === 'title' && issue.code === 'required')).toBe(true);
    expect(issues.some((issue) => issue.fieldKey === 'people_count' && issue.code === 'range')).toBe(true);
    expect(issues.some((issue) => issue.fieldKey === 'incomplete_reason')).toBe(false);
    expect(issues.some((issue) => issue.fieldKey === 'signature')).toBe(false);
  });

  it('only asks for finalize-required fields when finalizing', () => {
    let values: ValueMap = set({}, 'summary', 'title', 'Night shift');

    expect(validate(GOLDEN_SCHEMA, values, false).some((issue) => issue.fieldKey === 'signature')).toBe(false);
    expect(validate(GOLDEN_SCHEMA, values, true).some((issue) => issue.fieldKey === 'signature')).toBe(true);

    values = set(values, 'signoff', 'signature', '2026-09-06T00:00:00Z');
    expect(validate(GOLDEN_SCHEMA, values, true).some((issue) => issue.fieldKey === 'signature')).toBe(false);
  });

  it('round-trips stored cells through the value map without inventing rows', () => {
    const values = toValueMap([
      { SectionKey: 'summary', FieldKey: 'title', Value: 'Night shift' },
      { SectionKey: 'crew', FieldKey: 'member', RowKey: 'row-1', Ordinal: 0, Value: 'member-1' },
      { SectionKey: 'crew', FieldKey: 'member', RowKey: 'row-2', Ordinal: 1, Value: 'member-2' },
      { SectionKey: 'summary', FieldKey: 'narrative', Value: '   ' },
    ]);

    expect(rowKeysFor(values, 'crew')).toEqual(['row-1', 'row-2']);
    const payload = toValueList(values);
    expect(payload).toHaveLength(3);
    expect(payload.some((value) => value.FieldKey === 'narrative')).toBe(false);
  });

  it('never authors a protected definition offline, whatever its surface asked for', () => {
    expect(canAuthorOffline(goldenCatalogEntry())).toBe(true);
    expect(canAuthorOffline(goldenCatalogEntry({ AllowOffline: false }))).toBe(false);
    expect(canAuthorOffline(goldenCatalogEntry({ AllowOffline: true, RequiresProtectedGrant: true }))).toBe(false);
    expect(canAuthorOffline(null)).toBe(false);
  });

  it('treats an attachment and a signature as supported but a future control as not', () => {
    expect(isSupportedField({ Key: 'a', Label: 'A', Type: RmsFieldType.Attachment, Classification: 1 })).toBe(true);
    expect(isSupportedField({ Key: 'b', Label: 'B', Type: RmsFieldType.Signature, Classification: 1 })).toBe(true);
    expect(isSupportedField({ Key: 'c', Label: 'C', Type: 99 as RmsFieldType, Classification: 1 })).toBe(false);
  });
});
