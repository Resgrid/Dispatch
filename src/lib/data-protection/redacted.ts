/**
 * Recognising a protected value the server declined to decrypt (ADP plan 7.2).
 *
 * There are two signals and they are not equal. The authoritative one is the RedactedFields list
 * the server returns beside the record: it names exactly which catalog fields were withheld. The
 * literal placeholder in the value is the fallback for payloads that carry no list.
 *
 * The list is preferred because value-sniffing has a false positive that matters — a member can
 * legitimately type "REDACTED" into a call note, and masking their own words would be a bug the
 * member cannot explain or work around.
 */

/** The exact sentinel the server substitutes. Compare with strict equality; never localize it. */
export const REDACTION_VALUE = 'REDACTED';

/** Catalog field ids, matching the server's protected-field catalog. */
export const ProtectedFieldIds = {
  callName: 'calls.name',
  callNature: 'calls.natureofcall',
  callNotes: 'calls.notes',
  callAddress: 'calls.address',
  callContactName: 'calls.contactname',
  callContactNumber: 'calls.contactnumber',
  callGeolocation: 'calls.geolocationdata',
  callWhat3Words: 'calls.w3w',

  contactFirstName: 'contacts.firstname',
  contactLastName: 'contacts.lastname',
  contactCompanyName: 'contacts.companyname',
  contactEmail: 'contacts.email',
  contactHomePhone: 'contacts.homephonenumber',
  contactCellPhone: 'contacts.cellphonenumber',

  callNote: 'callnotes.note',

  personnelIdentificationNumber: 'departmentmembersensitivedata.identificationnumber',
  personnelNotes: 'departmentmembersensitivedata.notes',
  personnelHomeAddress: 'departmentmembersensitivedata.homeaddress1',
  personnelMailingAddress: 'departmentmembersensitivedata.mailingaddress1',

  emergencyContactName: 'departmentmemberemergencycontacts.name',
  emergencyContactRelationship: 'departmentmemberemergencycontacts.relationship',
  emergencyContactPhone: 'departmentmemberemergencycontacts.phonenumber',
  emergencyContactEmail: 'departmentmemberemergencycontacts.email',

  unitLogNarrative: 'unitlogs.narrative',
  userStateNote: 'userstates.note',

  calendarTitle: 'calendaritems.title',
  calendarDescription: 'calendaritems.description',
  calendarLocation: 'calendaritems.location',
} as const;

/**
 * True when this field was withheld.
 *
 * `fieldId` is checked against the server's list first. When no list is present — an older payload,
 * or an endpoint that does not carry one — the sentinel value is the fallback.
 */
export const isFieldRedacted = (redactedFields: string[] | null | undefined, fieldId: string, value?: string | null): boolean => {
  // An empty list is a list: the server said "nothing was withheld from this record", and that is
  // a stronger statement than the sentinel can make. Treating [] as absent would re-mask a member
  // who legitimately typed REDACTED, which is the false positive the list exists to prevent.
  if (redactedFields != null) {
    return redactedFields.some((field) => field?.toLowerCase() === fieldId.toLowerCase());
  }

  return value === REDACTION_VALUE;
};

/**
 * True when a value is the bare sentinel, for surfaces with no field id to hand (a list cell built
 * from a summary DTO). Weaker than isFieldRedacted and should not be preferred to it.
 */
export const isRedactedValue = (value?: string | null): boolean => value === REDACTION_VALUE;
