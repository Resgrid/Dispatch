import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import {
  type AccountMethodsData,
  completePasskeyRegistration,
  getAccountMethods,
  getPasskeyRegistrationOptions,
  renamePasskey,
  reportActivity,
  revokePasskey,
  setPasskeyApproval,
  stopApprovalInstallations,
} from '@/api/mfa/account-security';
import { type AccountProof, AccountVerifyModal } from '@/components/mfa/account-verify-modal';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { RESGRID_CLIENT } from '@/lib/mfa/client-app';
import { toMfaProblem } from '@/lib/mfa/errors';
import { mfaErrorKey } from '@/lib/mfa/messages';
import { createPasskeyCredential, passkeysSupported } from '@/lib/mfa/passkey';
import { isPasskeyCeremonyError } from '@/lib/mfa/passkey-errors';
import { parseUtc, type PasskeyData } from '@/lib/mfa/types';
import useAuthStore from '@/stores/auth/store';

const APP_NAMES: Record<string, string> = { web: 'Resgrid Web', responder: 'Resgrid Responder', unit: 'Resgrid Unit', dispatch: 'Resgrid Dispatch', ic: 'Resgrid Command' };

const when = (value: string | null | undefined): string | null => {
  const parsed = parseUtc(value);
  return parsed ? new Date(parsed).toLocaleString() : null;
};

/**
 * Sign-in and security (passkey plan section 6.5): the authenticator app and recovery codes, passkeys for this app and
 * where the others are, the Responder installations that approve sign-ins, linked organization sign-in, and 30 days of
 * verifications with "This wasn't me". Every change asks for the proof the server requires first.
 */
export default function AccountSecurity() {
  const { t } = useTranslation();
  const [methods, setMethods] = useState<AccountMethodsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [proof, setProof] = useState<AccountProof | null>(null);
  const proofResult = useRef<((verified: boolean) => void) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMethods(await getAccountMethods());
      setErrorCode(null);
    } catch (error) {
      setErrorCode(toMfaProblem(error).code);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Asks for the proof the server named, and resolves whether the member gave it. */
  const prove = useCallback(
    (kind: AccountProof) =>
      new Promise<boolean>((resolve) => {
        proofResult.current = resolve;
        setProof(kind);
      }),
    []
  );

  const onProofDone = useCallback((verified: boolean) => {
    setProof(null);
    proofResult.current?.(verified);
    proofResult.current = null;
  }, []);

  /** Runs a change; when the server asks for fresh proof first, asks for it and tries again (at most twice). */
  const change = useCallback(
    async (action: () => Promise<unknown>, done?: string) => {
      setBusy(true);
      setErrorCode(null);
      setNotice(null);
      try {
        for (let round = 0; round < 3; round++) {
          try {
            const result = await action();
            if ((result as { CurrentSessionEnded?: boolean } | undefined)?.CurrentSessionEnded) {
              await useAuthStore.getState().logout('Sign-in methods changed');
              return;
            }
            if (done) {
              setNotice(done);
            }
            await load();
            return;
          } catch (error) {
            if (isPasskeyCeremonyError(error)) {
              setErrorCode(`passkey_${error.reason}`);
              return;
            }
            const code = toMfaProblem(error).code;
            const needed: AccountProof | null = code === 'reauthentication_required' ? 'reauthenticate' : code === 'step_up_required' ? 'step_up' : null;
            if (!needed || !(await prove(needed))) {
              setErrorCode(needed ? null : code);
              return;
            }
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [load, prove]
  );

  const addPasskey = () =>
    void change(async () => {
      const ceremony = await getPasskeyRegistrationOptions();
      const credential = await createPasskeyCredential(ceremony.Options);
      return completePasskeyRegistration(ceremony.RequestId, credential, '');
    }, t('mfa.account.passkey_added'));

  const ownGroup = methods?.PasskeyGroups.find((g) => g.Client === (methods.CurrentClient ?? RESGRID_CLIENT));
  const otherGroups = (methods?.PasskeyGroups ?? []).filter((g) => g !== ownGroup && g.Passkeys.length > 0);

  const renderPasskey = (passkey: PasskeyData) => (
    <Box key={passkey.PasskeyId} className="rounded-lg border border-outline-200 p-3" testID={`passkey-${passkey.PasskeyId}`}>
      <VStack space="xs">
        <Text className="font-semibold">{passkey.DisplayName}</Text>
        <Text size="sm">{t('mfa.account.passkey_created', { time: when(passkey.CreatedOn) ?? '' })}</Text>
        {passkey.LastUsedOn ? <Text size="sm">{t('mfa.account.passkey_last_used', { time: when(passkey.LastUsedOn) ?? '' })}</Text> : null}
        {passkey.ApprovalEnabled !== null ? (
          <HStack space="sm" className="items-center">
            <Switch value={!!passkey.ApprovalEnabled} onValueChange={(enabled) => void change(() => setPasskeyApproval(passkey.PasskeyId, enabled))} isDisabled={busy} testID={`passkey-approval-${passkey.PasskeyId}`} />
            <Text size="sm">{t('mfa.account.passkey_approves')}</Text>
          </HStack>
        ) : null}
        <HStack space="sm">
          <Button size="xs" variant="outline" action="secondary" isDisabled={busy} onPress={() => setRenaming({ id: passkey.PasskeyId, name: passkey.DisplayName })}>
            <ButtonText>{t('mfa.account.rename')}</ButtonText>
          </Button>
          <Button size="xs" variant="outline" action="negative" isDisabled={busy} onPress={() => void change(() => revokePasskey(passkey.PasskeyId), t('mfa.account.passkey_removed'))}>
            <ButtonText>{t('mfa.account.remove')}</ButtonText>
          </Button>
        </HStack>
      </VStack>
    </Box>
  );

  return (
    <>
      <Stack.Screen options={{ title: t('mfa.account.title') }} />
      <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}>
        <VStack space="lg">
          {notice ? (
            <Text size="sm" className="text-success-600" testID="account-notice" accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
          {errorCode ? (
            <Text size="sm" className="text-error-600" testID="account-error" accessibilityLiveRegion="polite" accessibilityRole="alert" role="alert">
              {t(mfaErrorKey(errorCode))}
            </Text>
          ) : null}

          {methods ? (
            <>
              <VStack space="sm" testID="account-totp">
                <Heading size="md">{t('mfa.account.authenticator')}</Heading>
                <Text size="sm">{methods.Totp.Enrolled ? t('mfa.account.authenticator_on', { time: when(methods.Totp.EnrolledOn) ?? '' }) : t('mfa.account.authenticator_off')}</Text>
                {methods.Totp.Enrolled ? (
                  <Text size="sm" className={methods.Totp.RecoveryCodeWarning ? 'text-warning-600' : ''}>
                    {t('mfa.account.recovery_codes_left', { count: methods.Totp.RecoveryCodesRemaining })}
                  </Text>
                ) : null}
              </VStack>

              <VStack space="sm" testID="account-passkeys">
                <Heading size="md">{t('mfa.account.passkeys_here')}</Heading>
                {ownGroup && ownGroup.Passkeys.length > 0 ? ownGroup.Passkeys.map(renderPasskey) : <Text size="sm">{t('mfa.account.no_passkeys')}</Text>}
                {ownGroup?.RegistrationAvailable && passkeysSupported() ? (
                  <Button action="primary" onPress={addPasskey} isDisabled={busy} testID="account-add-passkey">
                    {busy ? <Spinner size="small" /> : <ButtonText>{t('mfa.account.add_passkey')}</ButtonText>}
                  </Button>
                ) : null}
                {otherGroups.map((group) => (
                  <Text key={group.Client} size="sm" testID={`account-passkeys-${group.Client}`}>
                    {t('mfa.account.passkeys_elsewhere', { app: APP_NAMES[group.Client] ?? group.Client, count: group.Passkeys.length })}
                  </Text>
                ))}
              </VStack>

              {methods.ApprovalInstallations.length > 0 ? (
                <VStack space="sm" testID="account-approvals">
                  <Heading size="md">{t('mfa.account.approvals')}</Heading>
                  {methods.ApprovalInstallations.map((installation) => (
                    <HStack key={installation.InstallationId} space="sm" className="items-center justify-between">
                      <VStack className="flex-1">
                        <Text size="sm" className="font-semibold">
                          {installation.Label ?? installation.Platform ?? t('mfa.account.this_device')}
                          {installation.IsCurrent ? ` · ${t('mfa.account.this_device')}` : ''}
                        </Text>
                        <Text size="sm">{installation.ApprovalsOn ? t('mfa.account.approvals_on') : t('mfa.account.approvals_off')}</Text>
                      </VStack>
                      {installation.ApprovalsOn ? (
                        <Button size="xs" variant="outline" action="negative" isDisabled={busy} onPress={() => void change(() => stopApprovalInstallations(installation.InstallationId))}>
                          <ButtonText>{t('mfa.account.stop_approvals')}</ButtonText>
                        </Button>
                      ) : null}
                    </HStack>
                  ))}
                </VStack>
              ) : null}

              {methods.LinkedIdentities.length > 0 ? (
                <VStack space="sm" testID="account-linked">
                  <Heading size="md">{t('mfa.account.linked')}</Heading>
                  {methods.LinkedIdentities.map((link) => (
                    <Text key={link.DepartmentId} size="sm">
                      {link.DepartmentName ?? link.DepartmentId}
                      {link.AcceptsProviderStepUp ? ` · ${t('mfa.account.linked_step_up')}` : ''}
                    </Text>
                  ))}
                </VStack>
              ) : null}

              <VStack space="sm" testID="account-activity">
                <Heading size="md">{t('mfa.account.activity')}</Heading>
                {methods.RecentActivity.length === 0 ? <Text size="sm">{t('mfa.account.no_activity')}</Text> : null}
                {methods.RecentActivity.map((activity) => (
                  <HStack key={activity.ActivityId} space="sm" className="items-center justify-between">
                    <VStack className="flex-1">
                      <Text size="sm" className="font-semibold">
                        {t(`mfa.account.activity_${activity.Successful ? 'ok' : 'failed'}`, {
                          method: t(`mfa.methods.${activity.Method}`, activity.Method),
                          app: (activity.Client && APP_NAMES[activity.Client]) ?? '',
                        })}
                      </Text>
                      <Text size="sm">{when(activity.OccurredOn)}</Text>
                    </VStack>
                    {activity.Successful && !activity.ReportedOn ? (
                      <Button
                        size="xs"
                        variant="outline"
                        action="negative"
                        isDisabled={busy}
                        onPress={() => void change(() => reportActivity(activity.ActivityId), t('mfa.account.reported'))}
                        testID={`activity-report-${activity.ActivityId}`}
                      >
                        <ButtonText>{t('mfa.account.not_me')}</ButtonText>
                      </Button>
                    ) : null}
                  </HStack>
                ))}
              </VStack>
            </>
          ) : loading ? (
            <Spinner size="large" />
          ) : null}

          {renaming ? (
            <VStack space="sm" testID="account-rename">
              <Input variant="outline" size="md" isDisabled={busy}>
                <InputField value={renaming.name} onChangeText={(name) => setRenaming({ ...renaming, name })} maxLength={100} aria-label={t('mfa.account.rename')} />
              </Input>
              <HStack space="sm">
                <Button size="sm" variant="outline" action="secondary" onPress={() => setRenaming(null)}>
                  <ButtonText>{t('common.cancel')}</ButtonText>
                </Button>
                <Button
                  size="sm"
                  action="primary"
                  isDisabled={busy || renaming.name.trim().length === 0}
                  onPress={() => {
                    const { id, name } = renaming;
                    setRenaming(null);
                    void change(() => renamePasskey(id, name.trim()));
                  }}
                >
                  <ButtonText>{t('mfa.account.save')}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          ) : null}
        </VStack>
      </ScrollView>
      <AccountVerifyModal proof={proof} onDone={onProofDone} />
    </>
  );
}
