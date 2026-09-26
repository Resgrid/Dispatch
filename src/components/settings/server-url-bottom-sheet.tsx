import { ChevronDownIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView } from 'react-native';

import { logger } from '@/lib/logging';
import { buildApiUrl, CUSTOM_SERVER_VALUE, findLocationByUrl, isSameServerUrl, loadServerLocations, toBaseUrl, URL_PATTERN } from '@/lib/server-url';
import { type ResgridSystemLocation } from '@/models/v4/configs/getSystemConfigResultData';
import { useServerUrlStore } from '@/stores/app/server-url-store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '../ui/actionsheet';
import { Button, ButtonSpinner, ButtonText } from '../ui/button';
import { Center } from '../ui/center';
import { FormControl, FormControlError, FormControlErrorText, FormControlHelperText, FormControlLabel, FormControlLabelText } from '../ui/form-control';
import { HStack } from '../ui/hstack';
import { Input, InputField } from '../ui/input';
import { Select, SelectBackdrop, SelectContent, SelectDragIndicator, SelectDragIndicatorWrapper, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '../ui/select';
import { Spinner } from '../ui/spinner';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

interface ServerUrlForm {
  url: string;
}

interface ServerUrlBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // Called after a save that switched to a different server. The session's tokens belong to
  // the previous server, so a signed-in caller should log out (as Responder does).
  onUrlChanged?: () => Promise<void> | void;
}

export function ServerUrlBottomSheet({ isOpen, onClose, onUrlChanged }: ServerUrlBottomSheetProps) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingServers, setIsLoadingServers] = React.useState(false);
  const [locations, setLocations] = React.useState<ResgridSystemLocation[]>([]);
  const [selectedServer, setSelectedServer] = React.useState<string>(CUSTOM_SERVER_VALUE);
  const { setUrl, getUrl } = useServerUrlStore();

  const {
    control,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ServerUrlForm>();

  const isCustomSelected = selectedServer === CUSTOM_SERVER_VALUE;

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isCancelled = false;

    const loadServers = async () => {
      setIsLoadingServers(true);
      clearErrors();

      try {
        // The persisted value includes the /api/vX suffix; reduce it to a bare base so we
        // can match it against a hosted site or show it for editing in the custom field.
        const currentUrl = await getUrl();
        const currentBaseUrl = toBaseUrl(currentUrl);
        // Always includes the Resgrid hosted sites, even if the current server can't be reached.
        const fetchedLocations = await loadServerLocations();

        if (isCancelled) {
          return;
        }

        setLocations(fetchedLocations);

        // Preselect the hosted site whose API URL matches the persisted URL; otherwise fall
        // back to the Custom option and show the persisted URL so the user can edit it.
        const matchedLocation = findLocationByUrl(fetchedLocations, currentUrl);
        if (matchedLocation) {
          setSelectedServer(matchedLocation.Name);
          setValue('url', toBaseUrl(matchedLocation.ApiUrl));
        } else {
          setSelectedServer(CUSTOM_SERVER_VALUE);
          setValue('url', currentBaseUrl);
        }
      } catch (error) {
        logger.error({ message: 'Failed to initialize server selection', context: { error } });
      } finally {
        setIsLoadingServers(false);
      }
    };

    loadServers();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, getUrl, setValue, clearErrors]);

  const handleServerChange = React.useCallback(
    (nextServer: string) => {
      setSelectedServer(nextServer);
      if (nextServer === CUSTOM_SERVER_VALUE) {
        return;
      }
      const location = locations.find((item) => item.Name === nextServer);
      if (location) {
        // Mirror the selected site's URL into the (read-only) field for visibility.
        setValue('url', toBaseUrl(location.ApiUrl));
      }
    },
    [locations, setValue]
  );

  const onFormSubmit = async (data: ServerUrlForm) => {
    try {
      setIsLoading(true);
      const location = locations.find((item) => item.Name === selectedServer);
      // Use the custom-entered URL, or the selected hosted site's URL, and always persist
      // the full API URL (with the /api/vX suffix) that the API client expects.
      const resolvedBaseUrl = isCustomSelected ? data.url : (location?.ApiUrl ?? data.url);
      const apiUrl = buildApiUrl(resolvedBaseUrl);
      const previousUrl = await getUrl();
      await setUrl(apiUrl);
      logger.info({
        message: 'Server URL updated successfully',
        context: { url: apiUrl, server: selectedServer },
      });

      if (onUrlChanged && !isSameServerUrl(previousUrl, apiUrl)) {
        await onUrlChanged();
      }

      onClose();
    } catch (error) {
      logger.error({
        message: 'Failed to update server URL',
        context: { error },
      });
      setError('root', { message: error instanceof Error ? error.message : t('common.error') });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedLocation = locations.find((location) => location.Name === selectedServer);
  const selectedServerLabel = isCustomSelected ? t('settings.custom') : selectedLocation?.Name;

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[80]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className={`rounded-t-3xl px-4 pb-6 ${colorScheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }} showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}>
          <VStack space="lg" className="mt-4 w-full">
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText className={`text-sm font-medium ${colorScheme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>{t('settings.server')}</FormControlLabelText>
              </FormControlLabel>
              {isLoadingServers ? (
                <HStack space="sm" className="items-center py-3">
                  <Spinner />
                  <Text size="sm" className={colorScheme === 'dark' ? 'text-neutral-300' : 'text-neutral-600'}>
                    {t('settings.loading_servers')}
                  </Text>
                </HStack>
              ) : (
                <Select selectedValue={selectedServer} onValueChange={handleServerChange}>
                  <SelectTrigger className={`flex-row items-center justify-between rounded-lg border ${colorScheme === 'dark' ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'}`}>
                    <SelectInput placeholder={t('settings.select_server')} value={selectedServerLabel} />
                    <SelectIcon as={ChevronDownIcon} className="mr-3" />
                  </SelectTrigger>
                  <SelectPortal>
                    <SelectBackdrop />
                    <SelectContent className="max-h-[60vh] pb-10">
                      <SelectDragIndicatorWrapper>
                        <SelectDragIndicator />
                      </SelectDragIndicatorWrapper>
                      {locations.map((location) => (
                        <SelectItem key={location.Name} label={location.Name} value={location.Name} />
                      ))}
                      <SelectItem label={t('settings.custom')} value={CUSTOM_SERVER_VALUE} />
                    </SelectContent>
                  </SelectPortal>
                </Select>
              )}
            </FormControl>

            <FormControl isRequired={isCustomSelected} isInvalid={isCustomSelected ? !!errors.url : false}>
              <FormControlLabel>
                <FormControlLabelText className={`text-sm font-medium ${colorScheme === 'dark' ? 'text-neutral-200' : 'text-neutral-700'}`}>{t('settings.server_url')}</FormControlLabelText>
              </FormControlLabel>
              <Controller
                control={control}
                name="url"
                rules={{
                  validate: (value) => {
                    // Only the Custom option requires a user-entered URL; hosted sites are
                    // pre-filled from their definition and don't need validation.
                    if (!isCustomSelected) {
                      return true;
                    }
                    if (!value) {
                      return t('form.required');
                    }
                    return URL_PATTERN.test(value) ? true : t('form.invalid_url');
                  },
                }}
                render={({ field: { onChange, value } }) => (
                  <Input className={`rounded-lg border ${colorScheme === 'dark' ? 'border-neutral-700 bg-neutral-800' : 'border-neutral-200 bg-neutral-50'} ${isCustomSelected ? '' : 'opacity-60'}`}>
                    <InputField
                      value={value}
                      onChangeText={onChange}
                      placeholder={t('settings.enter_server_url')}
                      editable={isCustomSelected && !isLoadingServers}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      textContentType="URL"
                      returnKeyType="done"
                      autoFocus={false}
                      blurOnSubmit={true}
                    />
                  </Input>
                )}
              />
              <FormControlHelperText>
                <FormControlError>
                  <FormControlErrorText>{errors.url?.message}</FormControlErrorText>
                </FormControlError>
              </FormControlHelperText>
            </FormControl>
            <Center>
              <Text size="md" className="text-center text-red-500">
                {t('settings.server_url_note')}
              </Text>
            </Center>

            {errors.root?.message ? (
              <Text size="sm" className="text-center text-red-500">
                {errors.root.message}
              </Text>
            ) : null}

            <HStack space="md" className="mt-4">
              <Button variant="outline" className="flex-1" onPress={onClose}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button className="flex-1 bg-primary-600" onPress={handleSubmit(onFormSubmit)} disabled={isLoading || isLoadingServers}>
                {isLoading ? <ButtonSpinner /> : <ButtonText>{t('common.save')}</ButtonText>}
              </Button>
            </HStack>
          </VStack>
        </ScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
