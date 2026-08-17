import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { getNoteCategories, saveNote } from '@/api/notes/notes';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { logger } from '@/lib/logging';
import { type NoteCategoryResultData } from '@/models/v4/notes/noteCategoryResultData';
import { SaveNoteInput } from '@/models/v4/notes/saveNoteInput';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Button, ButtonSpinner, ButtonText } from '../ui/button';
import { FormControl, FormControlError, FormControlErrorText, FormControlLabel, FormControlLabelText } from '../ui/form-control';
import { HStack } from '../ui/hstack';
import { Input, InputField } from '../ui/input';
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '../ui/select';
import { Text } from '../ui/text';
import { Textarea, TextareaInput } from '../ui/textarea';
import { VStack } from '../ui/vstack';

interface AddNoteForm {
  title: string;
  body: string;
  category: string;
}

interface AddNoteBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded: () => void;
}

export function AddNoteBottomSheet({ isOpen, onClose, onNoteAdded }: AddNoteBottomSheetProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const keyboardHeight = useKeyboardHeight();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState<NoteCategoryResultData[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddNoteForm>({
    defaultValues: {
      title: '',
      body: '',
      category: '',
    },
  });

  // Fetch categories when sheet opens
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  // Reset form when sheet closes
  useEffect(() => {
    if (!isOpen) {
      reset();
      setSaveError(null);
    }
  }, [isOpen, reset]);

  const fetchCategories = async () => {
    setIsCategoriesLoading(true);
    try {
      const response = await getNoteCategories();
      if (response?.Data) {
        setCategories(response.Data);
      }
    } catch (error) {
      logger.error({
        message: 'Failed to fetch note categories',
        context: { error },
      });
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  const onFormSubmit = async (data: AddNoteForm) => {
    setIsLoading(true);
    setSaveError(null);
    try {
      const noteInput = new SaveNoteInput();
      noteInput.Title = data.title;
      noteInput.Body = data.body;
      noteInput.Category = data.category;
      noteInput.IsAdminOnly = false;
      noteInput.ExpiresOn = '';

      await saveNote(noteInput);

      logger.info({
        message: 'Note created successfully',
        context: { title: data.title },
      });

      setSaveError(null);
      onNoteAdded();
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const userFriendlyMessage = t('dispatch.note_save_error', { error: errorMessage });
      setSaveError(userFriendlyMessage);
      logger.error({
        message: 'Failed to create note',
        context: { error },
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose} snapPoints={[85]}>
      <ActionsheetBackdrop />
      {/* The sheet renders inside a native Modal the OS does not resize for the keyboard,
          so padding by the keyboard height reserves the covered strip. flexShrink on the
          scrollview lets it compress into the remaining space and actually scroll. */}
      <ActionsheetContent className={`rounded-t-3xl px-4 pb-6 ${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`} style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ScrollView keyboardShouldPersistTaps="handled" style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <VStack space="lg" className="mt-4 w-full">
            {/* Header */}
            <Text className={`text-xl font-semibold ${colorScheme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{t('dispatch.add_note_title')}</Text>

            {/* Error Display */}
            {saveError ? (
              <VStack className={`rounded-lg border p-3 ${colorScheme === 'dark' ? 'border-red-700 bg-red-900/20' : 'border-red-200 bg-red-50'}`}>
                <Text className={`text-sm ${colorScheme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{saveError}</Text>
              </VStack>
            ) : null}

            {/* Title Field */}
            <FormControl isRequired isInvalid={!!errors.title}>
              <FormControlLabel>
                <FormControlLabelText className={`text-sm font-medium ${colorScheme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>{t('dispatch.note_title_label')}</FormControlLabelText>
              </FormControlLabel>
              <Controller
                control={control}
                name="title"
                rules={{
                  required: t('form.required'),
                  minLength: {
                    value: 1,
                    message: t('form.required'),
                  },
                }}
                render={({ field: { onChange, value } }) => (
                  <Input className={`rounded-lg border ${colorScheme === 'dark' ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'}`}>
                    <InputField value={value} onChangeText={onChange} placeholder={t('dispatch.note_title_placeholder')} autoCapitalize="sentences" autoCorrect={true} returnKeyType="next" editable={!isLoading} />
                  </Input>
                )}
              />
              {errors.title ? (
                <FormControlError>
                  <FormControlErrorText>{errors.title.message}</FormControlErrorText>
                </FormControlError>
              ) : null}
            </FormControl>

            {/* Category Field */}
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText className={`text-sm font-medium ${colorScheme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>{t('dispatch.note_category_label')}</FormControlLabelText>
              </FormControlLabel>
              <Controller
                control={control}
                name="category"
                render={({ field: { onChange, value } }) => (
                  <Select selectedValue={value} onValueChange={onChange} isDisabled={isLoading || isCategoriesLoading}>
                    <SelectTrigger variant="outline" className={`rounded-lg border ${colorScheme === 'dark' ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'}`}>
                      <SelectInput placeholder={t('dispatch.note_category_placeholder')} className={colorScheme === 'dark' ? 'text-white' : 'text-gray-900'} />
                    </SelectTrigger>
                    <SelectPortal>
                      <SelectBackdrop />
                      <SelectContent>
                        <SelectDragIndicatorWrapper>
                          <SelectDragIndicator />
                        </SelectDragIndicatorWrapper>
                        <SelectItem label={t('dispatch.note_no_category')} value="" />
                        {categories.map((category) => (
                          <SelectItem key={category.NoteCategoryId} label={category.Category} value={category.Category} />
                        ))}
                      </SelectContent>
                    </SelectPortal>
                  </Select>
                )}
              />
            </FormControl>

            {/* Body Field */}
            <FormControl isRequired isInvalid={!!errors.body}>
              <FormControlLabel>
                <FormControlLabelText className={`text-sm font-medium ${colorScheme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>{t('dispatch.note_body_label')}</FormControlLabelText>
              </FormControlLabel>
              <Controller
                control={control}
                name="body"
                rules={{
                  required: t('form.required'),
                  minLength: {
                    value: 1,
                    message: t('form.required'),
                  },
                }}
                render={({ field: { onChange, value } }) => (
                  <Textarea className={`rounded-lg border ${colorScheme === 'dark' ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'}`} size="md">
                    <TextareaInput
                      value={value}
                      onChangeText={onChange}
                      placeholder={t('dispatch.note_body_placeholder')}
                      autoCapitalize="sentences"
                      autoCorrect={true}
                      editable={!isLoading}
                      style={styles.textareaInput}
                    />
                  </Textarea>
                )}
              />
              {errors.body ? (
                <FormControlError>
                  <FormControlErrorText>{errors.body.message}</FormControlErrorText>
                </FormControlError>
              ) : null}
            </FormControl>

            {/* Action Buttons */}
            <HStack space="md" className="mt-4">
              <Button variant="outline" className="flex-1" onPress={handleClose} disabled={isLoading}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button className="flex-1 bg-primary-600" onPress={handleSubmit(onFormSubmit)} disabled={isLoading}>
                {isLoading ? <ButtonSpinner /> : <ButtonText>{t('common.save')}</ButtonText>}
              </Button>
            </HStack>
          </VStack>
        </ScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  textareaInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
