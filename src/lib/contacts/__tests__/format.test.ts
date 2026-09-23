import { htmlToText, mapsUrls, parseCoordinates, withoutRedacted } from '@/lib/contacts/format';
import { type ContactResultData, ContactType } from '@/models/v4/contacts/contactResultData';

it('turns web-editor rich text into readable plain text', () => {
  expect(htmlToText('<p>Knox box at <b>north</b> door</p><p>Gate &amp; code</p><ul><li>Hydrant</li></ul><script>alert(1)</script>')).toBe('Knox box at north door\nGate & code\n• Hydrant');
  expect(htmlToText(null)).toBe('');
});

it('parses coordinates and builds a maps link for an address or a point', () => {
  expect(parseCoordinates('39.7392, -104.9903')).toEqual({ latitude: 39.7392, longitude: -104.9903 });
  expect(parseCoordinates('not a place')).toBeNull();
  expect(parseCoordinates('95, 10')).toBeNull();
  // The platform app link differs (maps: on iOS, geo: on Android); both carry the point or the encoded address.
  expect(mapsUrls('39.7392,-104.9903').app).toMatch(/39\.7392,-104\.9903.*q=39\.7392%2C-104\.9903$/);
  expect(mapsUrls('1 Main St, Denver').app).toMatch(/0,0\?q=1%20Main%20St%2C%20Denver$/);
  expect(mapsUrls('1 Main St').web).toBe('https://maps.google.com/?q=1%20Main%20St');
});

it('removes withheld values and names the fields so the sheet never shows or dials the sentinel', () => {
  const contact = { ContactId: 'c-1', ContactType: ContactType.Person, FirstName: 'Ana', CellPhoneNumber: 'REDACTED', Email: 'REDACTED', IsDeleted: false } as unknown as ContactResultData;
  const shown = withoutRedacted(contact);
  expect(shown.CellPhoneNumber).toBeUndefined();
  expect(shown.Email).toBeUndefined();
  expect(shown.FirstName).toBe('Ana');
  expect(shown.WithheldFields).toEqual(['CellPhoneNumber', 'Email']);
  expect(contact.CellPhoneNumber).toBe('REDACTED');
});
