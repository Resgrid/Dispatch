import { type Href, router, Stack } from 'expo-router';
import { ArchiveIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createArchivedCall } from '@/api/calls/calls';
import { DispatchSelectionModal } from '@/components/calls/dispatch-selection-modal';
import { DateTimeField } from '@/components/common/date-time-field';
import { OptionSelect } from '@/components/operations/option-select';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { FormControl, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { UsersIcon } from '@/components/ui/lucide-icons';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { useToast } from '@/hooks/use-toast';
import { ARCHIVED_CALL_STATES, type ArchivedCallForm, buildArchivedCallRequest } from '@/lib/archived-calls';
import { getCallCloseErrorMessage } from '@/lib/call-close';
import { describeCallFields, getMissingCallFieldsFromError, hasDispatchRecipients } from '@/lib/call-field-policy';
import { useArchivedCallsStore } from '@/stores/calls/archived-store';
import { useCallsStore } from '@/stores/calls/store';
import { type DispatchSelection } from '@/stores/dispatch/store';

const EMPTY_DISPATCH: DispatchSelection = { everyone: false, users: [], groups: [], roles: [], units: [] };

const initialForm = (): ArchivedCallForm => ({
  name: '',
  nature: '',
  note: '',
  priority: '',
  type: '',
  address: '',
  latitude: '',
  longitude: '',
  contactName: '',
  contactInfo: '',
  incidentId: '',
  referenceId: '',
  externalId: '',
  // As the web form does: now, for the dispatcher to move back to when the call happened.
  loggedOn: new Date().toISOString(),
  closedOn: '',
  state: '1',
  closedNotes: '',
  recalculateCallNumbers: false,
  dispatch: EMPTY_DISPATCH,
});

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <FormControl className="mb-4">
    <FormControlLabel>
      <FormControlLabelText>{label}</FormControlLabelText>
    </FormControlLabel>
    {children}
    {hint ? <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</Text> : null}
  </FormControl>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
    <Text className="mb-3 text-base font-semibold">{title}</Text>
    {children}
  </Card>
);

/**
 * Add Archived Call: enter a call that already happened. It is saved closed with the time it was logged; who it
 * went to is recorded on the call and nobody is notified.
 */
export default function NewArchivedCall() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { trackEvent } = useAnalytics();
  const callPriorities = useCallsStore((s) => s.callPriorities);
  const callTypes = useCallsStore((s) => s.callTypes);
  const fetchCallPriorities = useCallsStore((s) => s.fetchCallPriorities);
  const fetchCallTypes = useCallsStore((s) => s.fetchCallTypes);
  const [form, setForm] = useState<ArchivedCallForm>(initialForm);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCallPriorities();
    fetchCallTypes();
  }, [fetchCallPriorities, fetchCallTypes]);

  // The department's default priority, once the priorities are in, unless one was already picked.
  useEffect(() => {
    if (form.priority === '' && callPriorities.length > 0) {
      const defaultPriority = callPriorities.find((p) => p.IsDefault) ?? callPriorities[0];
      setForm((current) => (current.priority === '' ? { ...current, priority: String(defaultPriority.Id) } : current));
    }
  }, [callPriorities, form.priority]);

  const update = <K extends keyof ArchivedCallForm>(key: K, value: ArchivedCallForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const priorityOptions = useMemo(() => callPriorities.map((p) => ({ value: String(p.Id), label: p.Name })), [callPriorities]);
  const typeOptions = useMemo(() => [{ value: '', label: t('archived_calls.no_type') }, ...callTypes.map((type) => ({ value: type.Name, label: type.Name }))], [callTypes, t]);
  const stateOptions = useMemo(() => ARCHIVED_CALL_STATES.map((s) => ({ value: String(s.value), label: t(s.labelKey) })), [t]);

  const dispatchSummary = form.dispatch.everyone
    ? t('archived_calls.dispatched_everyone')
    : hasDispatchRecipients(form.dispatch)
      ? t('archived_calls.dispatched_summary', { users: form.dispatch.users.length, groups: form.dispatch.groups.length, roles: form.dispatch.roles.length, units: form.dispatch.units.length })
      : t('archived_calls.dispatched_none');

  const handleSubmit = async () => {
    const built = buildArchivedCallRequest(form);
    if ('errorKey' in built) {
      toast.error(t(built.errorKey));
      return;
    }

    setIsSubmitting(true);
    try {
      await createArchivedCall(built.request);

      trackEvent('archived_call_created', {
        state: built.request.state,
        hasDispatches: hasDispatchRecipients(form.dispatch),
        recalculateCallNumbers: built.request.recalculateCallNumbers === true,
      });
      toast.success(t('archived_calls.save_success'));

      // The list opens on the year the call was logged in, so the new call is in front of the dispatcher.
      useArchivedCallsStore.getState().showYear(String(new Date(built.request.loggedOnUtc).getFullYear()));
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/archived-calls' as Href);
      }
    } catch (error) {
      // The department's new-call field policy covers archived calls too; the server names what is missing.
      const missingOnServer = getMissingCallFieldsFromError(error);
      toast.error(missingOnServer ? t('calls.required_fields_missing', { fields: describeCallFields(missingOnServer, t) }) : (getCallCloseErrorMessage(error) ?? t('archived_calls.save_error')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const iconColor = colorScheme === 'dark' ? '#e5e7eb' : '#374151';

  return (
    <>
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          title: t('archived_calls.add_title'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <View className="size-full flex-1">
        <Box className="size-full w-full flex-1 bg-gray-50 dark:bg-gray-900">
          <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }} testID="archived-call-form">
            <View className="w-full self-center" style={{ maxWidth: 960 }}>
              <View className="mb-2 flex-row items-center">
                <ArchiveIcon size={22} color={iconColor} />
                <Text className="ml-2 text-2xl font-bold">{t('archived_calls.add_title')}</Text>
              </View>
              <Text className="mb-6 text-sm text-gray-600 dark:text-gray-400">{t('archived_calls.add_description')}</Text>

              <Section title={t('archived_calls.section_call')}>
                <Field label={`${t('calls.name')} *`}>
                  <Input>
                    <InputField value={form.name} onChangeText={(value: string) => update('name', value)} placeholder={t('calls.name_placeholder')} testID="archived-call-name" />
                  </Input>
                </Field>
                <Field label={`${t('calls.nature')} *`}>
                  <Textarea>
                    <TextareaInput value={form.nature} onChangeText={(value: string) => update('nature', value)} numberOfLines={4} placeholder={t('calls.nature_placeholder')} testID="archived-call-nature" />
                  </Textarea>
                </Field>
                <Field label={`${t('calls.priority')} *`}>
                  <OptionSelect
                    key={`priority-${form.priority}`}
                    value={form.priority}
                    options={priorityOptions}
                    placeholder={t('calls.select_priority')}
                    onChange={(value) => update('priority', value)}
                    testID="archived-call-priority"
                  />
                </Field>
                <Field label={t('calls.type')}>
                  <OptionSelect value={form.type} options={typeOptions} placeholder={t('calls.select_type')} onChange={(value) => update('type', value)} testID="archived-call-type" />
                </Field>
                <Field label={t('calls.note')}>
                  <Textarea>
                    <TextareaInput value={form.note} onChangeText={(value: string) => update('note', value)} numberOfLines={3} placeholder={t('calls.note_placeholder')} testID="archived-call-note" />
                  </Textarea>
                </Field>
              </Section>

              <Section title={t('archived_calls.section_closing')}>
                <Field label={`${t('archived_calls.logged_on')} *`}>
                  <DateTimeField value={form.loggedOn} onChange={(value) => update('loggedOn', value)} label={t('archived_calls.logged_on')} mode="datetime" clearable={false} testID="archived-call-logged-on" />
                </Field>
                <Field label={t('archived_calls.closed_on')} hint={t('archived_calls.closed_on_helper')}>
                  <DateTimeField value={form.closedOn} onChange={(value) => update('closedOn', value)} label={t('archived_calls.closed_on')} mode="datetime" testID="archived-call-closed-on" />
                </Field>
                <Field label={`${t('archived_calls.table_state')} *`}>
                  <OptionSelect value={form.state} options={stateOptions} placeholder={t('call_detail.close_call_type_placeholder')} onChange={(value) => update('state', value)} testID="archived-call-state" />
                </Field>
                <Field label={t('archived_calls.closing_notes')}>
                  <Textarea>
                    <TextareaInput
                      value={form.closedNotes}
                      onChangeText={(value: string) => update('closedNotes', value)}
                      numberOfLines={3}
                      placeholder={t('archived_calls.closing_notes_placeholder')}
                      testID="archived-call-closed-notes"
                    />
                  </Textarea>
                </Field>
              </Section>

              <Section title={t('archived_calls.section_location')}>
                <Field label={t('calls.address')} hint={t('archived_calls.address_helper')}>
                  <Input>
                    <InputField value={form.address} onChangeText={(value: string) => update('address', value)} placeholder={t('calls.address_placeholder')} testID="archived-call-address" />
                  </Input>
                </Field>
                <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                  <View style={{ flexGrow: 1, flexBasis: 200 }}>
                    <Field label={t('archived_calls.latitude')}>
                      <Input>
                        <InputField value={form.latitude} onChangeText={(value: string) => update('latitude', value)} placeholder="39.122639" keyboardType="numbers-and-punctuation" testID="archived-call-latitude" />
                      </Input>
                    </Field>
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 200 }}>
                    <Field label={t('archived_calls.longitude')}>
                      <Input>
                        <InputField value={form.longitude} onChangeText={(value: string) => update('longitude', value)} placeholder="-119.758773" keyboardType="numbers-and-punctuation" testID="archived-call-longitude" />
                      </Input>
                    </Field>
                  </View>
                </View>
              </Section>

              <Section title={t('archived_calls.section_contact')}>
                <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                  <View style={{ flexGrow: 1, flexBasis: 240 }}>
                    <Field label={t('calls.contact_name')}>
                      <Input>
                        <InputField value={form.contactName} onChangeText={(value: string) => update('contactName', value)} placeholder={t('calls.contact_name_placeholder')} testID="archived-call-contact-name" />
                      </Input>
                    </Field>
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 240 }}>
                    <Field label={t('calls.contact_info')}>
                      <Input>
                        <InputField value={form.contactInfo} onChangeText={(value: string) => update('contactInfo', value)} placeholder={t('calls.contact_info_placeholder')} testID="archived-call-contact-info" />
                      </Input>
                    </Field>
                  </View>
                </View>
                <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                  <View style={{ flexGrow: 1, flexBasis: 180 }}>
                    <Field label={t('calls.incident_id')}>
                      <Input>
                        <InputField value={form.incidentId} onChangeText={(value: string) => update('incidentId', value)} testID="archived-call-incident-id" />
                      </Input>
                    </Field>
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 180 }}>
                    <Field label={t('archived_calls.reference_id')}>
                      <Input>
                        <InputField value={form.referenceId} onChangeText={(value: string) => update('referenceId', value)} testID="archived-call-reference-id" />
                      </Input>
                    </Field>
                  </View>
                  <View style={{ flexGrow: 1, flexBasis: 180 }}>
                    <Field label={t('archived_calls.external_id')}>
                      <Input>
                        <InputField value={form.externalId} onChangeText={(value: string) => update('externalId', value)} testID="archived-call-external-id" />
                      </Input>
                    </Field>
                  </View>
                </View>
              </Section>

              <Section title={t('archived_calls.section_dispatched')}>
                <Text className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t('archived_calls.dispatched_hint')}</Text>
                <Button variant="outline" onPress={() => setShowDispatchModal(true)} className="w-full" testID="archived-call-select-dispatched">
                  <UsersIcon size={16} color={iconColor} />
                  <ButtonText className="ml-2">{t('archived_calls.select_dispatched')}</ButtonText>
                </Button>
                <Text className="mt-2 text-sm" testID="archived-call-dispatched-summary">
                  {dispatchSummary}
                </Text>
              </Section>

              <Section title={t('archived_calls.section_numbering')}>
                <View className="flex-row items-center justify-between">
                  <View className="mr-4 flex-1">
                    <Text className="font-medium">{t('archived_calls.recalculate_numbers')}</Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">{t('archived_calls.recalculate_numbers_hint')}</Text>
                  </View>
                  <Switch
                    value={form.recalculateCallNumbers}
                    onValueChange={(value: boolean) => update('recalculateCallNumbers', value)}
                    accessibilityLabel={t('archived_calls.recalculate_numbers')}
                    testID="archived-call-recalculate"
                  />
                </View>
              </Section>

              <View className="mt-2 flex-row justify-end" style={{ gap: 12 }}>
                <Button variant="outline" onPress={() => router.back()} isDisabled={isSubmitting} testID="archived-call-cancel">
                  <ButtonText>{t('common.cancel')}</ButtonText>
                </Button>
                <Button onPress={handleSubmit} isDisabled={isSubmitting} className="bg-primary-600" testID="archived-call-save">
                  <ButtonText>{isSubmitting ? t('common.submitting') : t('archived_calls.save')}</ButtonText>
                </Button>
              </View>
            </View>
          </ScrollView>
        </Box>
      </View>

      {/* Who it went to: recorded on the call only, nobody is notified. */}
      <DispatchSelectionModal isVisible={showDispatchModal} onClose={() => setShowDispatchModal(false)} onConfirm={(selection) => update('dispatch', selection)} initialSelection={form.dispatch} />
    </>
  );
}
