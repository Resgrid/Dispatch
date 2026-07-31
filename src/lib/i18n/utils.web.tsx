import type TranslateOptions from 'i18next';
import i18n from 'i18next';
import memoize from 'lodash.memoize';
import { useCallback, useEffect, useState } from 'react';
import { I18nManager, Platform } from 'react-native';

import { getItem } from '@/lib/storage';

import type { Language, resources } from './resources';
import type { RecursiveKeyOf } from './types';

type DefaultLocale = typeof resources.en.translation;
export type TxKeyPath = RecursiveKeyOf<DefaultLocale>;

export const LOCAL = 'local';

export const getLanguage = () => getItem<string>(LOCAL);

export const translate = memoize(
  (key: TxKeyPath, options = undefined) => i18n.t(key, options) as unknown as string,
  (key: TxKeyPath, options: typeof TranslateOptions) => (options ? key + JSON.stringify(options) : key)
);

export const changeLanguage = (lang: Language) => {
  const currentLanguage = i18n.language;
  const currentRTL = I18nManager.isRTL;

  if (currentLanguage === lang) {
    return;
  }

  i18n.changeLanguage(lang);

  const newRTL = lang === 'ar';

  if (Platform.OS === 'web') {
    if (currentRTL !== newRTL) {
      window.location.reload();
    }
  }
};

export const useSelectedLanguage = () => {
  const [language, setLangState] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const storedLang = localStorage.getItem(LOCAL);
      if (storedLang) {
        setLangState(storedLang);
      }
    } catch (e) {
      console.warn('localStorage.getItem failed', e);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLangState(lang);
    try {
      localStorage.setItem(LOCAL, lang);
    } catch (e) {
      console.warn('localStorage.setItem failed', e);
    }
    if (lang !== undefined) changeLanguage(lang as Language);
  }, []);

  return { language: language as Language, setLanguage };
};
