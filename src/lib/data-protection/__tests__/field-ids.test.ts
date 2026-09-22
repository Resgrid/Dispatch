import { ProtectedFieldIds } from '@/lib/data-protection/redacted';

/**
 * A wrong field id is SILENT: it simply never matches the server's RedactedFields list, so the
 * field renders raw and nothing looks broken until someone notices protected data on screen. These
 * pin the shape and the exact values against the server's protected-field catalog.
 */
describe('ProtectedFieldIds', () => {
  const ids = Object.entries(ProtectedFieldIds);

  it('are all lowercase table.field keys', () => {
    // Collected rather than asserted one at a time, so a failure names every offender at once.
    const malformed = ids.filter(([, id]) => !/^[a-z0-9]+\.[a-z0-9]+$/.test(id)).map(([name, id]) => `${name}=${id}`);

    expect(malformed).toEqual([]);
  });

  it('has no duplicates pointing at the same catalog field', () => {
    const values = ids.map(([, id]) => id);
    expect(new Set(values).size).toBe(values.length);
  });

  it('matches the server catalog for the surfaces the apps render', () => {
    // Copied from Core's ProtectedReadService accessor maps. If the catalog is renamed there, this
    // is what fails rather than a screen quietly showing plaintext.
    expect(ProtectedFieldIds.callName).toBe('calls.name');
    expect(ProtectedFieldIds.callNature).toBe('calls.natureofcall');
    expect(ProtectedFieldIds.callNotes).toBe('calls.notes');
    expect(ProtectedFieldIds.callAddress).toBe('calls.address');
    expect(ProtectedFieldIds.callContactName).toBe('calls.contactname');
    expect(ProtectedFieldIds.callContactNumber).toBe('calls.contactnumber');
    expect(ProtectedFieldIds.callNote).toBe('callnotes.note');

    expect(ProtectedFieldIds.contactFirstName).toBe('contacts.firstname');
    expect(ProtectedFieldIds.contactEmail).toBe('contacts.email');
    expect(ProtectedFieldIds.contactCellPhone).toBe('contacts.cellphonenumber');

    expect(ProtectedFieldIds.personnelIdentificationNumber).toBe('departmentmembersensitivedata.identificationnumber');
    expect(ProtectedFieldIds.emergencyContactName).toBe('departmentmemberemergencycontacts.name');

    expect(ProtectedFieldIds.userStateNote).toBe('userstates.note');
    expect(ProtectedFieldIds.unitLogNarrative).toBe('unitlogs.narrative');

    expect(ProtectedFieldIds.calendarTitle).toBe('calendaritems.title');
    expect(ProtectedFieldIds.calendarDescription).toBe('calendaritems.description');
    expect(ProtectedFieldIds.calendarLocation).toBe('calendaritems.location');
  });
});
