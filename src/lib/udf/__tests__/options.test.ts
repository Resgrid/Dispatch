import { comboDisplayText, filterComboSuggestions, findComboOption, parseUdfOptions, selectedOptionKeys, UDF_FIELD_TYPE, type UdfOption } from '../options';

// What the server stores in UdfField.ValidationRules (Newtonsoft, PascalCase).
const serverRules = JSON.stringify({
  MinLength: null,
  MaxLength: null,
  Regex: null,
  Options: [
    { Key: 'tx', Label: 'Transported' },
    { Key: 'refused', Label: 'Refused care' },
    { Key: 'Transported, ALS', Label: 'Transported, ALS' },
  ],
  CustomErrorMessage: null,
});

const options: UdfOption[] = [
  { key: 'tx', label: 'Transported' },
  { key: 'refused', label: 'Refused care' },
];

describe('parseUdfOptions', () => {
  it('reads key/label pairs from the server JSON rules', () => {
    expect(parseUdfOptions(serverRules)).toEqual([
      { key: 'tx', label: 'Transported' },
      { key: 'refused', label: 'Refused care' },
      { key: 'Transported, ALS', label: 'Transported, ALS' },
    ]);
  });

  it('accepts camelCase rules and falls back to the key for a missing label', () => {
    expect(parseUdfOptions('{"options":[{"key":"a"},{"key":"b","label":"Bee"}]}')).toEqual([
      { key: 'a', label: 'a' },
      { key: 'b', label: 'Bee' },
    ]);
  });

  it('drops options without a key', () => {
    expect(parseUdfOptions('{"Options":[{"Key":" ","Label":"Blank"},{"Key":"ok","Label":"OK"}]}')).toEqual([{ key: 'ok', label: 'OK' }]);
  });

  it('returns nothing for empty, option-less or malformed JSON rules rather than splitting them on commas', () => {
    expect(parseUdfOptions('')).toEqual([]);
    expect(parseUdfOptions(null)).toEqual([]);
    expect(parseUdfOptions('{"MinLength":3,"MaxLength":10}')).toEqual([]);
    expect(parseUdfOptions('{"Options":[')).toEqual([]);
  });

  it('accepts a legacy comma-separated list', () => {
    expect(parseUdfOptions('Red, Green ,Blue')).toEqual([
      { key: 'Red', label: 'Red' },
      { key: 'Green', label: 'Green' },
      { key: 'Blue', label: 'Blue' },
    ]);
  });
});

describe('findComboOption', () => {
  it('matches an exact key, then a label or key ignoring case', () => {
    expect(findComboOption(options, 'tx')?.key).toBe('tx');
    expect(findComboOption(options, '  refused CARE ')?.key).toBe('refused');
    expect(findComboOption(options, 'TX')?.key).toBe('tx');
  });

  it('returns undefined for free text or nothing typed', () => {
    expect(findComboOption(options, 'Referred to crisis line')).toBeUndefined();
    expect(findComboOption(options, '   ')).toBeUndefined();
  });
});

describe('comboDisplayText', () => {
  it('shows a stored key as its label and free text as typed', () => {
    expect(comboDisplayText(options, 'tx')).toBe('Transported');
    expect(comboDisplayText(options, 'Referred to crisis line')).toBe('Referred to crisis line');
    expect(comboDisplayText(options, 'REDACTED')).toBe('REDACTED');
    expect(comboDisplayText(options, undefined)).toBe('');
  });
});

describe('filterComboSuggestions', () => {
  it('offers every option when nothing is typed or the text already names one', () => {
    expect(filterComboSuggestions(options, '')).toEqual(options);
    expect(filterComboSuggestions(options, 'Transported')).toEqual(options);
  });

  it('narrows to labels containing the typed text', () => {
    expect(filterComboSuggestions(options, 'ref')).toEqual([{ key: 'refused', label: 'Refused care' }]);
    expect(filterComboSuggestions(options, 'zzz')).toEqual([]);
  });
});

describe('selectedOptionKeys', () => {
  it('splits only a multi-select value', () => {
    expect(selectedOptionKeys(UDF_FIELD_TYPE.MultiSelect, 'a, b,,c')).toEqual(['a', 'b', 'c']);
    expect(selectedOptionKeys(UDF_FIELD_TYPE.Dropdown, 'Transported, ALS')).toEqual(['Transported, ALS']);
    expect(selectedOptionKeys(UDF_FIELD_TYPE.Dropdown, '')).toEqual([]);
  });
});
