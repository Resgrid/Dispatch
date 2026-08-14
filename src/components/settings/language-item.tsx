import { ChevronDownIcon } from 'lucide-react-native';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { useSelectedLanguage } from '@/lib';
import { translate } from '@/lib';
import type { Language } from '@/lib/i18n/resources';

import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '../ui/select';
import { Text } from '../ui/text';
import { View } from '../ui/view';

export const LanguageItem = () => {
  const { language, setLanguage } = useSelectedLanguage();
  const { t } = useTranslation();
  const onSelect = React.useCallback(
    (option: string) => {
      setLanguage(option as Language);
    },
    [setLanguage]
  );

  const langs = React.useMemo(
    () => [
      { label: translate('settings.english'), value: 'en' },
      { label: translate('settings.spanish'), value: 'es' },
      { label: translate('settings.swedish'), value: 'sv' },
      { label: translate('settings.german'), value: 'de' },
      { label: translate('settings.greek'), value: 'el' },
      { label: translate('settings.french'), value: 'fr' },
      { label: translate('settings.italian'), value: 'it' },
      { label: translate('settings.polish'), value: 'pl' },
      { label: translate('settings.ukrainian'), value: 'uk' },
      { label: translate('settings.arabic'), value: 'ar' },
    ],
    []
  );

  const selectedLanguage = React.useMemo(() => langs.find((lang) => lang.value === language), [language, langs]);

  return (
    <View className="flex-1 flex-row items-center justify-between px-4 py-2">
      <View className="flex-row items-center">
        <Text>{t('settings.language')}</Text>
      </View>
      <View className="flex-row items-center">
        <Select onValueChange={onSelect} selectedValue={selectedLanguage?.value}>
          <SelectTrigger>
            <SelectInput placeholder="Select option" />
            <SelectIcon as={ChevronDownIcon} className="mr-3" />
          </SelectTrigger>
          <SelectPortal>
            <SelectBackdrop />
            <SelectContent>
              <SelectDragIndicatorWrapper>
                <SelectDragIndicator />
              </SelectDragIndicatorWrapper>
              {langs.map((theme) => (
                <SelectItem key={theme.value} label={theme.label} value={theme.value} />
              ))}
            </SelectContent>
          </SelectPortal>
        </Select>
      </View>
    </View>
  );
};
