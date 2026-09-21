import {
  type FieldRecordCatalogEntry,
  type RecordDefinitionSchema,
  RmsFieldClassification,
  RmsFieldType,
  RmsRuleEffect,
  RmsRuleOperator,
} from '@/models/v4/records';

/**
 * Shared golden fixtures for the Field Records renderer (RMS plan RMS-1D: "shared golden client
 * fixtures run against Responder, Unit, IC and Dispatch adapters"). This file is identical in all
 * four app repositories on purpose — platform presentation may differ, saved meaning must not.
 *
 * Every supported control appears once, plus a repeating section whose rules must evaluate per row,
 * a restricted field, a protected field, and a control this build cannot render.
 */

export const GOLDEN_SCHEMA: RecordDefinitionSchema = {
  Sections: [
    {
      Key: 'summary',
      Label: 'Summary',
      Fields: [
        { Key: 'title', Label: 'Title', Type: RmsFieldType.ShortText, Required: true, Classification: RmsFieldClassification.Standard },
        { Key: 'narrative', Label: 'Narrative', Type: RmsFieldType.LongText, Classification: RmsFieldClassification.Standard },
        { Key: 'people_count', Label: 'People', Type: RmsFieldType.Integer, Min: 0, Max: 500, Classification: RmsFieldClassification.Standard },
        { Key: 'hours', Label: 'Hours', Type: RmsFieldType.Decimal, Classification: RmsFieldClassification.Standard },
        { Key: 'was_transported', Label: 'Transported', Type: RmsFieldType.Boolean, Classification: RmsFieldClassification.Standard },
        { Key: 'occurred_on', Label: 'Occurred', Type: RmsFieldType.DateTime, Classification: RmsFieldClassification.Standard },
        { Key: 'duration', Label: 'Duration', Type: RmsFieldType.Duration, Classification: RmsFieldClassification.Standard },
        {
          Key: 'outcome',
          Label: 'Outcome',
          Type: RmsFieldType.SingleSelect,
          Classification: RmsFieldClassification.Standard,
          Options: [
            { Key: 'complete', Label: 'Complete' },
            { Key: 'incomplete', Label: 'Incomplete' },
            { Key: 'retired-option', Label: 'Retired', IsInactive: true },
          ],
        },
        {
          Key: 'hazards',
          Label: 'Hazards',
          Type: RmsFieldType.MultiSelect,
          Classification: RmsFieldClassification.Standard,
          Options: [
            { Key: 'smoke', Label: 'Smoke' },
            { Key: 'electrical', Label: 'Electrical' },
          ],
        },
        // Shown only when the outcome is incomplete, so a rule change must move it.
        {
          Key: 'incomplete_reason',
          Label: 'Why incomplete',
          Type: RmsFieldType.LongText,
          Classification: RmsFieldClassification.Standard,
          Rules: [{ Effect: RmsRuleEffect.Show, Condition: { Operator: RmsRuleOperator.Equals, FieldKey: 'outcome', Value: 'incomplete' } }],
        },
        // Required only when someone was transported.
        {
          Key: 'destination',
          Label: 'Destination',
          Type: RmsFieldType.ShortText,
          Classification: RmsFieldClassification.Standard,
          Rules: [{ Effect: RmsRuleEffect.Require, Condition: { Operator: RmsRuleOperator.Equals, FieldKey: 'was_transported', Value: 'true' } }],
        },
        { Key: 'scene_location', Label: 'Location', Type: RmsFieldType.Address, Classification: RmsFieldClassification.Standard },
        { Key: 'related_call', Label: 'Call', Type: RmsFieldType.CallReference, Classification: RmsFieldClassification.Standard },
        { Key: 'officer', Label: 'Officer', Type: RmsFieldType.Person, Classification: RmsFieldClassification.Standard },
        { Key: 'apparatus', Label: 'Unit', Type: RmsFieldType.Unit, Classification: RmsFieldClassification.Standard },
        { Key: 'station', Label: 'Group', Type: RmsFieldType.Group, Classification: RmsFieldClassification.Standard },
        { Key: 'contact', Label: 'Contact', Type: RmsFieldType.Contact, Classification: RmsFieldClassification.Standard },
        { Key: 'external_ref', Label: 'Reference', Type: RmsFieldType.ExternalReference, ReferenceType: 'permit', Classification: RmsFieldClassification.Standard },
        { Key: 'cost', Label: 'Cost', Type: RmsFieldType.Currency, DefaultCurrency: 'USD', Classification: RmsFieldClassification.Standard },
        { Key: 'water_used', Label: 'Water used', Type: RmsFieldType.Quantity, UnitDimension: 'volume', DefaultUnitCode: 'gal', Classification: RmsFieldClassification.Standard },
        { Key: 'subdivision', Label: 'State', Type: RmsFieldType.CountrySubdivision, Classification: RmsFieldClassification.Standard },
        { Key: 'photo', Label: 'Photo', Type: RmsFieldType.Attachment, Classification: RmsFieldClassification.Standard },
        { Key: 'patient_name', Label: 'Patient', Type: RmsFieldType.ShortText, Classification: RmsFieldClassification.Restricted },
        { Key: 'condition', Label: 'Condition', Type: RmsFieldType.LongText, Classification: RmsFieldClassification.Protected },
      ],
    },
    {
      Key: 'crew',
      Label: 'Crew',
      Repeating: true,
      MaxRows: 10,
      Fields: [
        { Key: 'member', Label: 'Member', Type: RmsFieldType.Person, Required: true, Classification: RmsFieldClassification.Standard },
        {
          Key: 'role',
          Label: 'Role',
          Type: RmsFieldType.SingleSelect,
          Classification: RmsFieldClassification.Standard,
          Options: [
            { Key: 'driver', Label: 'Driver' },
            { Key: 'officer', Label: 'Officer' },
          ],
        },
        // Per-row rule: this cell answers from its own row, never from another row's role.
        {
          Key: 'driver_note',
          Label: 'Driver note',
          Type: RmsFieldType.ShortText,
          Classification: RmsFieldClassification.Standard,
          Rules: [{ Effect: RmsRuleEffect.Show, Condition: { Operator: RmsRuleOperator.Equals, FieldKey: 'role', Value: 'driver' } }],
        },
      ],
    },
    {
      Key: 'signoff',
      Label: 'Sign-off',
      Fields: [{ Key: 'signature', Label: 'Signature', Type: RmsFieldType.Signature, RequiredToFinalize: true, Classification: RmsFieldClassification.Standard }],
    },
  ],
};

/** A definition naming a control this build cannot draw; authoring must fail closed. */
export const UNSUPPORTED_SCHEMA: RecordDefinitionSchema = {
  Sections: [
    {
      Key: 'main',
      Label: 'Main',
      Fields: [
        { Key: 'ok', Label: 'Fine', Type: RmsFieldType.ShortText, Classification: RmsFieldClassification.Standard },
        { Key: 'future', Label: 'Future control', Type: 99 as RmsFieldType, Classification: RmsFieldClassification.Standard },
      ],
    },
  ],
};

export const goldenCatalogEntry = (overrides: Partial<FieldRecordCatalogEntry> = {}): FieldRecordCatalogEntry => ({
  DefinitionKey: 'shift-log',
  Version: 3,
  Name: 'Shift log',
  Category: 'Operations',
  Locked: false,
  LifecyclePreset: 'QuickEntry',
  LaunchContexts: ['none'],
  AllowOffline: true,
  AllowAttachments: true,
  Restricted: false,
  RequiresProtectedGrant: false,
  SchemaChecksum: 'chk-shift-log',
  PrefillVersion: 3,
  SupportsPrefill: true,
  ...overrides,
});
