import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

interface RecoveryCodesProps {
  codes: string[];
}

/**
 * New recovery codes, shown once (passkey plan section 6.1). They are in memory only; the member copies or writes them
 * down now, because nothing can show them again.
 */
export const RecoveryCodes: React.FC<RecoveryCodesProps> = ({ codes }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await Clipboard.setStringAsync(codes.join('\n'));
    setCopied(true);
  }, [codes]);

  return (
    <VStack space="sm" testID="mfa-recovery-codes">
      <Text size="sm">{t('mfa.recovery_codes.body')}</Text>
      <Box className="rounded-lg bg-background-50 p-3">
        {codes.map((code) => (
          <Text key={code} selectable className="font-mono text-base" testID="mfa-recovery-code">
            {code}
          </Text>
        ))}
      </Box>
      <Button variant="outline" action="secondary" size="sm" onPress={() => void copy()} testID="mfa-recovery-codes-copy">
        <ButtonText>{copied ? t('mfa.recovery_codes.copied') : t('mfa.recovery_codes.copy')}</ButtonText>
      </Button>
    </VStack>
  );
};
