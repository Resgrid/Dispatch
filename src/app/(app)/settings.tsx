/* eslint-disable react/react-in-jsx-scope */
import { Env } from '@env';
import { useColorScheme } from 'nativewind';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Item } from '@/components/settings/item';
import { KeepAliveItem } from '@/components/settings/keep-alive-item';
import { LanguageItem } from '@/components/settings/language-item';
import { LoginInfoBottomSheet } from '@/components/settings/login-info-bottom-sheet';
import { ModernNotificationSoundsItem } from '@/components/settings/modern-notification-sounds-item';
import { ServerUrlBottomSheet } from '@/components/settings/server-url-bottom-sheet';
import { ThemeItem } from '@/components/settings/theme-item';
import { ToggleItem } from '@/components/settings/toggle-item';
import { FocusAwareStatusBar, ScrollView } from '@/components/ui';
import { Box } from '@/components/ui/box';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAuth, useAuthStore } from '@/lib';
import { logger } from '@/lib/logging';
import { getBaseApiUrl } from '@/lib/storage/app';
import { openLinkInBrowser } from '@/lib/utils';
import { useCoreStore } from '@/stores/app/core-store';
import { useUnitsStore } from '@/stores/units/store';

export default function Settings() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const signOut = useAuthStore.getState().logout;
  const { colorScheme } = useColorScheme();
  const [showLoginInfo, setShowLoginInfo] = React.useState(false);
  const { login, status, isAuthenticated } = useAuth();
  const [showServerUrl, setShowServerUrl] = React.useState(false);
  const [showUnitSelection, setShowUnitSelection] = React.useState(false);
  const activeUnit = useCoreStore((state) => state.activeUnit);
  const { units } = useUnitsStore();

  const activeUnitName = React.useMemo(() => {
    if (!activeUnit) return t('settings.none_selected');
    return activeUnit?.Name || t('common.unknown');
  }, [activeUnit, t]);

  const handleLoginInfoSubmit = async (data: { username: string; password: string }) => {
    logger.info({
      message: 'Updating login info',
    });
    await login({ username: data.username, password: data.password });
  };

  // The current session's tokens were issued by the previous server, so switching servers
  // signs the user out to log in again against the new one.
  const handleServerUrlChanged = React.useCallback(async () => {
    logger.info({
      message: 'Server URL changed, signing out',
    });
    await signOut();
  }, [signOut]);

  useEffect(() => {
    if (status === 'signedIn' && isAuthenticated) {
      logger.info({
        message: 'Setting Login info successful',
      });
    }
  }, [status, isAuthenticated]);

  // Track when settings view is rendered
  useEffect(() => {
    trackEvent('settings_view_rendered', {
      hasActiveUnit: !!activeUnit,
      unitName: activeUnit?.Name || 'none',
    });
  }, [trackEvent, activeUnit]);

  return (
    <Box className={`flex-1 ${colorScheme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <FocusAwareStatusBar />
      <ScrollView>
        <VStack className="md p-4">
          {/* App Info Section */}
          <Card className={`mb-4 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <Heading className="mb2 text-sm">{t('settings.app_info')}</Heading>
            <VStack space="sm">
              <Item text={t('settings.app_name')} value={Env.NAME} />
              <Item text={t('settings.version')} value={Env.VERSION} />
              <Item text={t('settings.environment')} value={Env.APP_ENV} />
            </VStack>
          </Card>

          {/* Account Section */}
          <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <Heading className="mb2 text-sm">{t('settings.account')}</Heading>
            <VStack space="sm">
              <Item text={t('settings.server')} value={getBaseApiUrl()} onPress={() => setShowServerUrl(true)} textStyle="text-info-600" />
              <Item text={t('settings.login_info')} onPress={() => setShowLoginInfo(true)} textStyle="text-info-600" />
              <Item text={t('settings.active_unit')} value={activeUnitName} onPress={() => setShowUnitSelection(true)} textStyle="text-info-600" />
              <Item text={t('settings.logout')} onPress={signOut} textStyle="text-error-600" />
            </VStack>
          </Card>

          {/* Preferences Section */}
          <Card className={`mb-4 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <Heading className="mb2 text-sm">{t('settings.preferences')}</Heading>
            <VStack space="sm">
              <ThemeItem />
              <LanguageItem />
              <KeepAliveItem />
              <ModernNotificationSoundsItem />
            </VStack>
          </Card>

          {/* Support Section */}
          <Card className={`mb-4 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <Heading className="mb2 text-sm">{t('settings.support')}</Heading>
            <VStack space="sm">
              <Item text={t('settings.help_center')} onPress={() => openLinkInBrowser('https://resgrid.zohodesk.com/portal/en/home')} />
              <Item text={t('settings.contact_us')} onPress={() => openLinkInBrowser('https://resgrid.com/contact')} />
              <Item text={t('settings.status_page')} onPress={() => openLinkInBrowser('https://resgrid.freshstatus.io')} />
              <Item text={t('settings.privacy_policy')} onPress={() => openLinkInBrowser('https://resgrid.com/privacy')} />
              <Item text={t('settings.terms')} onPress={() => openLinkInBrowser('https://resgrid.com/terms')} />
            </VStack>
          </Card>
        </VStack>
      </ScrollView>

      <LoginInfoBottomSheet isOpen={showLoginInfo} onClose={() => setShowLoginInfo(false)} onSubmit={handleLoginInfoSubmit} />
      <ServerUrlBottomSheet isOpen={showServerUrl} onClose={() => setShowServerUrl(false)} onUrlChanged={handleServerUrlChanged} />
    </Box>
  );
}
