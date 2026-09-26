import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { type ContactResultData, ContactType } from '@/models/v4/contacts/contactResultData';

import { ContactDetailsExtra } from '../contact-details-extra';

jest.mock('@/stores/contacts/store', () => ({
  useContactsStore: {
    getState: () => ({
      fetchContactNotes: jest.fn().mockResolvedValue(undefined),
      fetchContactDetails: jest.fn().mockResolvedValue(undefined),
    }),
  },
}));

jest.mock('@/components/data-protection/protected-reveal-bar', () => ({
  ProtectedRevealBar: () => null,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const makeContact = (customFields: ContactResultData['CustomFields']): ContactResultData =>
  ({
    ContactId: 'contact-1',
    ContactType: ContactType.Person,
    Name: 'Jane Doe',
    CustomFields: customFields,
  }) as ContactResultData;

describe('ContactDetailsExtra custom fields', () => {
  it('shows the display value the server resolved for option fields', () => {
    const contact = makeContact([
      { UdfFieldId: 'outcome', Label: 'Outcome', Value: 'tx', DisplayValue: 'Transported', FieldDataType: 11, GroupName: null, SortOrder: 0 },
      { UdfFieldId: 'priority', Label: 'Priority', Value: 'p1', DisplayValue: 'Priority 1', FieldDataType: 6, GroupName: 'Triage', SortOrder: 1 },
    ]);

    const { unmount } = render(<ContactDetailsExtra contact={contact} />);

    expect(screen.getByText('Transported')).toBeTruthy();
    expect(screen.getByText('Priority 1')).toBeTruthy();
    expect(screen.getByText('Triage · Priority')).toBeTruthy();
    expect(screen.queryByText('tx')).toBeNull();
    unmount();
  });

  it('falls back to the stored value when the server sends no display value', () => {
    const contact = makeContact([{ UdfFieldId: 'notes', Label: 'Notes', Value: 'Referred to crisis line', FieldDataType: 11, SortOrder: 0 }]);

    const { unmount } = render(<ContactDetailsExtra contact={contact} />);

    expect(screen.getByText('Referred to crisis line')).toBeTruthy();
    unmount();
  });

  it('hides custom fields when the host renders its own', () => {
    const contact = makeContact([{ UdfFieldId: 'outcome', Label: 'Outcome', Value: 'tx', DisplayValue: 'Transported', FieldDataType: 11, SortOrder: 0 }]);

    const { unmount } = render(<ContactDetailsExtra contact={contact} showCustomFields={false} />);

    expect(screen.queryByTestId('contact-custom-fields')).toBeNull();
    unmount();
  });
});
