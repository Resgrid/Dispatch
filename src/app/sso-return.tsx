import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { Spinner } from '@/components/ui/spinner';

// The page the Resgrid SSO broker returns to (passkey plan section 7.7.2). The browser auth session that opened the
// provider reads the one-time code from this URL; on the web this popup hands it back and closes. Nothing is read or
// stored here, and a stray visit simply goes back.
WebBrowser.maybeCompleteAuthSession();

export default function SsoReturn() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center" testID="sso-return">
      <Spinner size="large" />
    </View>
  );
}
