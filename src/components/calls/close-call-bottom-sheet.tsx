import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView } from 'react-native';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Button, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useCallsStore } from '@/stores/calls/store';
import { useToastStore } from '@/stores/toast/store';

interface CloseCallBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
  isLoading?: boolean;
}

export const CloseCallBottomSheet: React.FC<CloseCallBottomSheetProps> = ({ isOpen, onClose, callId, isLoading = false }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();
  const showToast = useToastStore((state) => state.showToast);
  const { trackEvent } = useAnalytics();
  const { closeCall } = useCallDetailStore();
  const { fetchCalls } = useCallsStore();
  const [closeCallType, setCloseCallType] = useState('');
  const [closeCallNote, setCloseCallNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track when close call bottom sheet is opened/rendered
  React.useEffect(() => {
    if (isOpen) {
      trackEvent('close_call_bottom_sheet_opened', {
        callId: callId,
        isLoading: isLoading,
      });
    }
  }, [isOpen, trackEvent, callId, isLoading]);

  const handleClose = React.useCallback(() => {
    setCloseCallType('');
    setCloseCallNote('');
    onClose();
  }, [onClose]);

  const handleSubmit = React.useCallback(async () => {
    if (!closeCallType) {
      showToast('error', t('call_detail.close_call_type_required'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Call the closeCall API
      await closeCall({
        callId,
        type: parseInt(closeCallType),
        note: closeCallNote,
      });

      // Show success toast
      showToast('success', t('call_detail.close_call_success'));

      // Close the bottom sheet
      handleClose();

      // Refresh the call list
      await fetchCalls();

      // Navigate back to close the call detail screen
      router.back();
    } catch (error) {
      console.error('Error closing call:', error);
      // Show error toast
      showToast('error', t('call_detail.close_call_error'));
    } finally {
      setIsSubmitting(false);
    }
  }, [closeCallType, showToast, t, callId, closeCallNote, handleClose, fetchCalls, router, closeCall]);

  const isButtonDisabled = isLoading || isSubmitting;

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} testID="close-call-actionsheet">
      <ActionsheetBackdrop />
      {/* Same keyboard treatment as the status sheet: the sheet is bottom-anchored
          and content-sized, so padding it by the keyboard height slides it up out
          from under the keyboard, max-h caps it, and shrink lets the scrollview
          compress and scroll instead of Yoga clipping the overflow. */}
      <ActionsheetContent className="max-h-[90%] bg-white dark:bg-gray-900" style={{ paddingBottom: keyboardHeight }}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="w-full shrink p-4">
          <Heading size="lg" className="mb-4 text-center">
            {t('call_detail.close_call')}
          </Heading>

          {/* Plain ScrollView on purpose: the sheet already slides above the keyboard via
              the ActionsheetContent paddingBottom. KeyboardAwareScrollView also reacts to
              the keyboard (its events are window-agnostic), so it compensated a second
              time and pushed the note field out of the sheet's visible area. */}
          <ScrollView
            keyboardShouldPersistTaps={Platform.OS === 'android' ? 'handled' : 'always'}
            showsVerticalScrollIndicator={false}
            style={{ flexGrow: 0, flexShrink: 1, width: '100%' }}
            testID="close-call-scroll-view"
          >
            <VStack space="md" className="w-full">
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t('call_detail.close_call_type')}</FormControlLabelText>
                </FormControlLabel>
                <Select selectedValue={closeCallType} onValueChange={setCloseCallType} testID="close-call-type-select">
                  <SelectTrigger>
                    <SelectInput placeholder={t('call_detail.close_call_type_placeholder')} />
                    <SelectIcon />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent>
                      <SelectItem label={t('call_detail.close_call_types.closed')} value="1" />
                      <SelectItem label={t('call_detail.close_call_types.cancelled')} value="2" />
                      <SelectItem label={t('call_detail.close_call_types.unfounded')} value="3" />
                      <SelectItem label={t('call_detail.close_call_types.founded')} value="4" />
                      <SelectItem label={t('call_detail.close_call_types.minor')} value="5" />
                      <SelectItem label={t('call_detail.close_call_types.transferred')} value="6" />
                      <SelectItem label={t('call_detail.close_call_types.false_alarm')} value="7" />
                    </SelectContent>
                  </SelectPortal>
                </Select>
              </FormControl>

              <VStack space="sm">
                <Text className="font-medium">{t('call_detail.close_call_note')}</Text>
                <Textarea size="md" className="min-h-[100px] w-full">
                  <TextareaInput placeholder={t('call_detail.close_call_note_placeholder')} value={closeCallNote} onChangeText={setCloseCallNote} numberOfLines={4} testID="close-call-note-input" />
                </Textarea>
              </VStack>

              <HStack space="sm" className="mt-4 justify-between">
                <Button variant="outline" className="flex-1" onPress={handleClose} isDisabled={isButtonDisabled}>
                  <ButtonText>{t('common.cancel')}</ButtonText>
                </Button>
                <Button className="flex-1 bg-green-600" onPress={handleSubmit} isDisabled={isButtonDisabled}>
                  <ButtonText>{isSubmitting ? t('common.submitting') : t('call_detail.close_call')}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          </ScrollView>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};
