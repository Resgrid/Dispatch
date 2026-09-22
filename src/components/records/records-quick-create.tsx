import { router } from 'expo-router';
import { FilePlus2 } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { type FieldRecordContextInput } from '@/models/v4/records';
import { useRecordsFieldStatus } from '@/stores/feature-flags/store';
import { useRecordsStore } from '@/stores/records/store';

// Contextual create (RMS plan RMS-1D): start a Record from the thing the person is already looking
// at. The button appears only when the server has actually offered something for this context, so a
// dead end is impossible; the context itself is verified server-side on every request.

interface RecordsQuickCreateProps {
  context: FieldRecordContextInput;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'link';
  className?: string;
  testID?: string;
}

export const RecordsQuickCreate: React.FC<RecordsQuickCreateProps> = ({ context, size = 'sm', variant = 'outline', className, testID = 'records-quick-create' }) => {
  const { t } = useTranslation();
  const flagStatus = useRecordsFieldStatus();
  const setContext = useRecordsStore((state) => state.setContext);
  const fetchCatalog = useRecordsStore((state) => state.fetchCatalog);
  const catalog = useRecordsStore((state) => state.catalog);

  useEffect(() => {
    if (flagStatus !== 'enabled') {
      return;
    }
    setContext(context);
    void fetchCatalog();
  }, [flagStatus, context, setContext, fetchCatalog]);

  if (flagStatus !== 'enabled' || (catalog?.Definitions?.length ?? 0) === 0) {
    return null;
  }

  return (
    <Button action="secondary" size={size} variant={variant} className={className} onPress={() => router.push('/records/new')} testID={testID}>
      <ButtonIcon as={FilePlus2} />
      <ButtonText>{t('records.new_record')}</ButtonText>
    </Button>
  );
};
