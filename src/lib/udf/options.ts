// User-defined field (UDF) option handling shared by the call, personnel, unit and contact custom-field UI.
// Mirrors Resgrid.Model.Helpers.UdfValidationHelper on the server so what the app shows and sends matches what the
// server stores.

/** Server FieldDataType values (Resgrid.Model.UdfFieldDataType). */
export const UDF_FIELD_TYPE = {
  Text: 0,
  Number: 1,
  Decimal: 2,
  Boolean: 3,
  Date: 4,
  DateTime: 5,
  Dropdown: 6,
  MultiSelect: 7,
  Email: 8,
  Phone: 9,
  Url: 10,
  /** Options are suggestions; a value naming an option is stored as its key, anything else as the typed text. */
  ComboBox: 11,
} as const;

/** A predefined option. The key is what the server stores; the label is what a person reads. */
export interface UdfOption {
  key: string;
  label: string;
}

interface RawUdfOption {
  Key?: unknown;
  Label?: unknown;
  key?: unknown;
  label?: unknown;
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

const toOption = (raw: RawUdfOption): UdfOption | null => {
  const key = asText(raw.Key ?? raw.key).trim();
  if (!key) return null;
  const label = asText(raw.Label ?? raw.label).trim();
  return { key, label: label || key };
};

/**
 * Reads the options out of a field's ValidationRules. The server sends the rules as a JSON string
 * ({"Options":[{"Key":"tx","Label":"Transported"}],...}); a plain comma-separated list is accepted for older data.
 */
export const parseUdfOptions = (validationRules: string | null | undefined): UdfOption[] => {
  const rules = (validationRules ?? '').trim();
  if (!rules) return [];

  if (rules.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(rules);
      if (parsed && typeof parsed === 'object') {
        const record = parsed as { Options?: unknown; options?: unknown };
        const list = record.Options ?? record.options;
        if (Array.isArray(list)) {
          return list
            .filter((o): o is RawUdfOption => Boolean(o) && typeof o === 'object')
            .map(toOption)
            .filter((o): o is UdfOption => o !== null);
        }
      }
      return [];
    } catch {
      return [];
    }
  }

  return rules
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
    .map((o) => ({ key: o, label: o }));
};

/**
 * The option a combo box entry refers to: an exact key first, then a label or key ignoring case (the server's rule).
 * Undefined means the entry is free text.
 */
export const findComboOption = (options: UdfOption[], value: string | null | undefined): UdfOption | undefined => {
  const text = (value ?? '').trim();
  if (!text) return undefined;
  const lower = text.toLowerCase();
  return options.find((o) => o.key === text) ?? options.find((o) => o.label.toLowerCase() === lower) ?? options.find((o) => o.key.toLowerCase() === lower);
};

/** The text a combo box input shows for a stored value: an option key shows its label, free text shows as typed. */
export const comboDisplayText = (options: UdfOption[], value: string | null | undefined): string => {
  const text = value ?? '';
  const option = options.find((o) => o.key === text);
  return option ? option.label : text;
};

/**
 * Suggestions to offer under a combo box. Nothing typed, or text that already names an option, offers every option so
 * the choice can be changed; otherwise the options whose label contains the text.
 */
export const filterComboSuggestions = (options: UdfOption[], text: string | null | undefined): UdfOption[] => {
  const query = (text ?? '').trim().toLowerCase();
  if (!query || findComboOption(options, query)) return options;
  return options.filter((o) => o.label.toLowerCase().includes(query));
};

/** The keys a stored dropdown or multi-select value selects. */
export const selectedOptionKeys = (fieldDataType: number, value: string | null | undefined): string[] => {
  const text = (value ?? '').trim();
  if (!text) return [];
  if (fieldDataType === UDF_FIELD_TYPE.MultiSelect) {
    return text
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }
  return [text];
};
