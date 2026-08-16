import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDownIcon, ChevronUpIcon, MapPinIcon, SaveIcon, SearchIcon, XIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as z from 'zod';

import { getNewCallData } from '@/api/dispatch/dispatch';
import { forwardGeocode } from '@/api/geocoding/geocoding';
import { saveUdfValues } from '@/api/userDefinedFields/userDefinedFields';
import { DispatchSelectionModal } from '@/components/calls/dispatch-selection-modal';
import { UdfFieldsRenderer } from '@/components/calls/udf-fields-renderer';
import { Loading } from '@/components/common/loading';
import FullScreenLocationPicker from '@/components/maps/full-screen-location-picker';
import LocationPicker from '@/components/maps/location-picker';
import { Box } from '@/components/ui/box';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { useAnalytics } from '@/hooks/use-analytics';
import { getPoiDestinationOptionLabel } from '@/lib/poi-display';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type UdfFieldValueInput } from '@/models/v4/userDefinedFields/udfFieldValueInput';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useCallsStore } from '@/stores/calls/store';
import { type DispatchSelection } from '@/stores/dispatch/store';

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nature: z.string().min(1, 'Nature is required'),
  note: z.string().optional(),
  destinationPoiId: z.string().optional(),
  address: z.string().optional(),
  coordinates: z.string().optional(),
  what3words: z.string().optional(),
  plusCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  priority: z.string().min(1, 'Priority is required'),
  type: z.string().min(1, 'Type is required'),
  contactName: z.string().optional(),
  contactInfo: z.string().optional(),
  dispatchSelection: z.object({
    everyone: z.boolean(),
    users: z.array(z.string()),
    groups: z.array(z.string()),
    roles: z.array(z.string()),
    units: z.array(z.string()),
  }),
});

type FormValues = z.infer<typeof formSchema>;

const NO_DESTINATION_VALUE = '__none__';

interface GeocodingResult {
  place_id: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
}

interface GeocodingResponse {
  results: GeocodingResult[];
  status: string;
}

// Web-optimized input component
interface WebInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  autoFocus?: boolean;
  testID?: string;
  disabled?: boolean;
  rightElement?: React.ReactNode;
}

const WebInput: React.FC<WebInputProps> = ({ label, placeholder, value, onChange, onBlur, error, multiline = false, rows = 1, required = false, onKeyDown, autoFocus = false, testID, disabled = false, rightElement }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const inputStyles = StyleSheet.flatten([
    webStyles.webInput as any,
    isDark ? styles.webInputDark : styles.webInputLight,
    error ? styles.webInputError : {},
    disabled ? (webStyles.webInputDisabled as any) : {},
    multiline ? { minHeight: rows * 24 + 16 } : {},
  ]);

  return (
    <View style={styles.webInputContainer}>
      <Text style={StyleSheet.flatten([styles.webLabel, isDark ? styles.webLabelDark : styles.webLabelLight])}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.inputWrapper}>
        {multiline ? (
          <textarea
            style={inputStyles as React.CSSProperties}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            rows={rows}
            autoFocus={autoFocus}
            data-testid={testID}
            disabled={disabled}
          />
        ) : (
          <input
            type="text"
            style={inputStyles as React.CSSProperties}
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKeyDown as any}
            autoFocus={autoFocus}
            data-testid={testID}
            disabled={disabled}
          />
        )}
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

// Web-optimized select component
interface WebSelectProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ id: string | number; name: string; color?: string }>;
  error?: string;
  required?: boolean;
  useIdValue?: boolean;
}

const WebSelect: React.FC<WebSelectProps> = ({ label, placeholder, value, onChange, options, error, required = false, useIdValue = false }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.webInputContainer}>
      <Text style={StyleSheet.flatten([styles.webLabel, isDark ? styles.webLabelDark : styles.webLabelLight])}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <select
        style={StyleSheet.flatten([webStyles.webSelect as any, isDark ? styles.webSelectDark : styles.webSelectLight, error ? styles.webInputError : {}]) as React.CSSProperties}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={useIdValue ? String(option.id) : option.name}>
            {option.name}
          </option>
        ))}
      </select>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

export default function EditCallWeb() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const { width } = useWindowDimensions();

  const { callPriorities, callTypes, isLoading: callDataLoading, error: callDataError, fetchCallPriorities, fetchCallTypes } = useCallsStore();
  const { call, callExtraData, isLoading: callDetailLoading, error: callDetailError, fetchCallDetail } = useCallDetailStore();
  const { config } = useCoreStore();
  const toast = useToast();

  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showAddressSelection, setShowAddressSelection] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [destinationPois, setDestinationPois] = useState<PoiResultData[]>([]);
  const [isLoadingDestinationPois, setIsLoadingDestinationPois] = useState(false);
  const [dispatchSelection, setDispatchSelection] = useState<DispatchSelection>({
    everyone: false,
    users: [],
    groups: [],
    roles: [],
    units: [],
  });
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [udfValues, setUdfValues] = useState<UdfFieldValueInput[]>([]);
  const [isAdditionalFieldsExpanded, setIsAdditionalFieldsExpanded] = useState(false);

  const isDark = colorScheme === 'dark';
  const isWideScreen = width >= 1024;

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    reset,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      nature: '',
      note: '',
      destinationPoiId: '',
      address: '',
      coordinates: '',
      what3words: '',
      plusCode: '',
      latitude: undefined,
      longitude: undefined,
      priority: '',
      type: '',
      contactName: '',
      contactInfo: '',
      dispatchSelection: {
        everyone: false,
        users: [],
        groups: [],
        roles: [],
        units: [],
      },
    },
  });

  const watchedAddress = watch('address');

  useEffect(() => {
    fetchCallPriorities();
    fetchCallTypes();
    if (callId) fetchCallDetail(callId);
  }, [fetchCallPriorities, fetchCallTypes, fetchCallDetail, callId]);

  useEffect(() => {
    let isMounted = true;

    setIsLoadingDestinationPois(true);
    getNewCallData()
      .then((result) => {
        if (isMounted) {
          setDestinationPois(result?.Data?.DestinationPois || []);
        }
      })
      .catch((error) => {
        console.error('Failed to load destination POIs:', error);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingDestinationPois(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Pre-populate form when call data is loaded
  useEffect(() => {
    if (call) {
      const priority = callPriorities.find((p) => p.Id === call.Priority);
      const type = callTypes.find((t) => t.Id === call.Type);

      // Build dispatch selection from existing dispatches
      const initialDispatch: DispatchSelection = {
        everyone: false,
        users: [],
        groups: [],
        roles: [],
        units: [],
      };

      if (callExtraData?.Dispatches) {
        callExtraData.Dispatches.forEach((dispatch) => {
          const dispatchType = (dispatch.Type || '').toLowerCase();
          if (dispatchType === 'personnel' || dispatchType === 'p' || dispatchType === 'user') {
            initialDispatch.users.push(dispatch.Id);
          } else if (dispatchType === 'group' || dispatchType === 'groups' || dispatchType === 'g') {
            initialDispatch.groups.push(dispatch.Id);
          } else if (dispatchType === 'role' || dispatchType === 'roles' || dispatchType === 'r') {
            initialDispatch.roles.push(dispatch.Id);
          } else if (dispatchType === 'unit' || dispatchType === 'units' || dispatchType === 'u') {
            initialDispatch.units.push(dispatch.Id);
          }
        });
      }

      setDispatchSelection(initialDispatch);

      reset({
        name: call.Name || '',
        nature: call.Nature || '',
        note: call.Note || '',
        destinationPoiId: call.DestinationPoiId ? call.DestinationPoiId.toString() : '',
        address: call.Address || '',
        coordinates: call.Geolocation || '',
        what3words: '',
        plusCode: '',
        latitude: call.Latitude ? parseFloat(call.Latitude) : undefined,
        longitude: call.Longitude ? parseFloat(call.Longitude) : undefined,
        priority: priority?.Name || '',
        type: type?.Name || '',
        contactName: call.ContactName || '',
        contactInfo: call.ContactInfo || '',
        dispatchSelection: initialDispatch,
      });

      if (call.Latitude && call.Longitude) {
        setSelectedLocation({
          latitude: parseFloat(call.Latitude),
          longitude: parseFloat(call.Longitude),
          address: call.Address || undefined,
        });
      }
    }
  }, [call, callExtraData, callPriorities, callTypes, reset]);

  useEffect(() => {
    if (call) {
      trackEvent('edit_call_web_view_rendered', {
        callId: call.CallId || '',
        callName: call.Name || '',
        hasCoordinates: !!(call.Latitude && call.Longitude),
      });
    }
  }, [trackEvent, call]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
      if (e.key === 'Escape') {
        if (showLocationPicker) {
          setShowLocationPicker(false);
        } else if (showAddressSelection) {
          setShowAddressSelection(false);
        } else if (showDispatchModal) {
          setShowDispatchModal(false);
        } else {
          router.back();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLocationPicker, showAddressSelection, showDispatchModal]);

  const onSubmit = async (data: FormValues) => {
    if (!callId) {
      toast.show({
        placement: 'top',
        render: () => (
          <Box className="rounded-lg bg-red-500 p-4 shadow-lg">
            <Text className="text-white">{t('call_detail.missing_call_id')}</Text>
          </Box>
        ),
      });
      return;
    }

    try {
      setIsSubmitting(true);

      if (selectedLocation?.latitude && selectedLocation?.longitude) {
        data.latitude = selectedLocation.latitude;
        data.longitude = selectedLocation.longitude;
      }

      const priority = callPriorities.find((p) => p.Name === data.priority);
      const type = callTypes.find((t) => t.Name === data.type);

      await useCallDetailStore.getState().updateCall({
        callId: callId,
        name: data.name,
        nature: data.nature,
        priority: priority?.Id || 0,
        type: type?.Id || '',
        note: data.note,
        destinationPoiId: data.destinationPoiId ? Number(data.destinationPoiId) : null,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        what3words: data.what3words,
        plusCode: data.plusCode,
        contactName: data.contactName,
        contactInfo: data.contactInfo,
        dispatchUsers: data.dispatchSelection?.users,
        dispatchGroups: data.dispatchSelection?.groups,
        dispatchRoles: data.dispatchSelection?.roles,
        dispatchUnits: data.dispatchSelection?.units,
        dispatchEveryone: data.dispatchSelection?.everyone,
      });

      if (udfValues.length > 0 && callId) {
        try {
          await saveUdfValues(0, callId, udfValues);
        } catch (udfError) {
          console.warn('Failed to save UDF values:', udfError);
        }
      }

      toast.show({
        placement: 'top',
        render: () => (
          <Box className="rounded-lg bg-green-500 p-4 shadow-lg">
            <Text className="text-white">{t('call_detail.update_call_success')}</Text>
          </Box>
        ),
      });

      router.back();
    } catch (err) {
      console.error('Error updating call:', err);
      toast.show({
        placement: 'top',
        render: () => (
          <Box className="rounded-lg bg-red-500 p-4 shadow-lg">
            <Text className="text-white">{t('call_detail.update_call_error')}</Text>
          </Box>
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationSelected = useCallback(
    (location: { latitude: number; longitude: number; address?: string }) => {
      setSelectedLocation(location);
      setValue('latitude', location.latitude, { shouldDirty: true });
      setValue('longitude', location.longitude, { shouldDirty: true });
      if (location.address) {
        setValue('address', location.address, { shouldDirty: true });
      }
      setValue('coordinates', `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`, { shouldDirty: true });
      setShowLocationPicker(false);
    },
    [setValue]
  );

  const handleDispatchSelection = useCallback(
    (selection: DispatchSelection) => {
      setDispatchSelection(selection);
      setValue('dispatchSelection', selection, { shouldDirty: true });
      setShowDispatchModal(false);
    },
    [setValue]
  );

  const getDispatchSummary = () => {
    if (dispatchSelection.everyone) return t('calls.everyone');
    const totalSelected = dispatchSelection.users.length + dispatchSelection.groups.length + dispatchSelection.roles.length + dispatchSelection.units.length;
    if (totalSelected === 0) return t('calls.select_recipients');
    return `${totalSelected} ${t('calls.selected')}`;
  };

  const handleAddressSearch = async (address: string) => {
    if (!address.trim()) {
      toast.show({
        placement: 'top',
        render: () => (
          <Box className="rounded-lg bg-orange-500 p-4 shadow-lg">
            <Text className="text-white">{t('calls.address_required')}</Text>
          </Box>
        ),
      });
      return;
    }

    setIsGeocodingAddress(true);
    try {
      // Proxied through the Resgrid API — see src/api/geocoding/geocoding.ts for why.
      const lookup = await forwardGeocode(address);

      if (lookup.candidates.length > 0) {
        const results = lookup.candidates;
        if (results.length === 1) {
          const result = results[0];
          handleLocationSelected({
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            address: result.formatted_address,
          });
          toast.show({
            placement: 'top',
            render: () => (
              <Box className="rounded-lg bg-green-500 p-4 shadow-lg">
                <Text className="text-white">{t('calls.address_found')}</Text>
              </Box>
            ),
          });
        } else {
          setAddressResults(results);
          setShowAddressSelection(true);
        }
      } else {
        // The lookup running and matching nothing is a different problem to the lookup failing.
        toast.show({
          placement: 'top',
          render: () => (
            <Box className="rounded-lg bg-red-500 p-4 shadow-lg">
              <Text className="text-white">{t(lookup.succeeded ? 'calls.address_not_found' : 'calls.geocoding_error')}</Text>
            </Box>
          ),
        });
      }
    } catch (err) {
      console.error('Error geocoding address:', err);
      toast.show({
        placement: 'top',
        render: () => (
          <Box className="rounded-lg bg-red-500 p-4 shadow-lg">
            <Text className="text-white">{t('calls.geocoding_error')}</Text>
          </Box>
        ),
      });
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  const handleAddressSelected = (result: GeocodingResult) => {
    handleLocationSelected({
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      address: result.formatted_address,
    });
    setShowAddressSelection(false);
    toast.show({
      placement: 'top',
      render: () => (
        <Box className="rounded-lg bg-green-500 p-4 shadow-lg">
          <Text className="text-white">{t('calls.address_found')}</Text>
        </Box>
      ),
    });
  };

  if (callDetailLoading || callDataLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t('calls.edit_call'), headerShown: true, headerBackTitle: '' }} />
        <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight])}>
          <Loading />
        </View>
      </>
    );
  }

  if (callDetailError || callDataError || !call) {
    return (
      <>
        <Stack.Screen options={{ title: t('calls.edit_call'), headerShown: true, headerBackTitle: '' }} />
        <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight])}>
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5">
            <Text className="error text-center">{callDetailError || callDataError || 'Call not found'}</Text>
          </Box>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('calls.edit_call'), headerShown: true, headerBackTitle: '' }} />

      <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight])}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View>
                <Text style={StyleSheet.flatten([styles.callNumber, isDark ? styles.callNumberDark : styles.callNumberLight])}>#{call.Number}</Text>
                <Text style={StyleSheet.flatten([styles.title, isDark ? styles.titleDark : styles.titleLight])}>{t('calls.edit_call')}</Text>
              </View>
              {isDirty ? (
                <View style={styles.unsavedBadge}>
                  <Text style={styles.unsavedBadgeText}>{t('common.unsaved_changes', 'Unsaved changes')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={StyleSheet.flatten([styles.subtitle, isDark ? styles.subtitleDark : styles.subtitleLight])}>{t('calls.edit_call_web_hint', 'Update the call details below. Press Ctrl+S to save.')}</Text>
          </View>

          {/* Main Content - Two Column Layout for Wide Screens */}
          <View style={isWideScreen ? styles.twoColumnLayout : styles.singleColumnLayout}>
            {/* Left Column - Call Details */}
            <View style={isWideScreen ? styles.leftColumn : styles.fullWidth}>
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight])}>{t('calls.call_details')}</Text>

                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <WebInput label={t('calls.name')} placeholder={t('calls.name_placeholder')} value={value} onChange={onChange} onBlur={onBlur} error={errors.name?.message} required autoFocus testID="name-input" />
                  )}
                />

                <Controller
                  control={control}
                  name="nature"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <WebInput
                      label={t('calls.nature')}
                      placeholder={t('calls.nature_placeholder')}
                      value={value}
                      onChange={onChange}
                      onBlur={onBlur}
                      error={errors.nature?.message}
                      multiline
                      rows={3}
                      required
                      testID="nature-input"
                    />
                  )}
                />

                <View style={styles.twoInputRow}>
                  <View style={styles.halfWidth}>
                    <Controller
                      control={control}
                      name="priority"
                      render={({ field: { onChange, value } }) => (
                        <WebSelect
                          label={t('calls.priority')}
                          placeholder={t('calls.select_priority')}
                          value={value}
                          onChange={onChange}
                          options={callPriorities.map((p) => ({ id: p.Id, name: p.Name, color: p.Color }))}
                          error={errors.priority?.message}
                          required
                        />
                      )}
                    />
                  </View>
                  <View style={styles.halfWidth}>
                    <Controller
                      control={control}
                      name="type"
                      render={({ field: { onChange, value } }) => (
                        <WebSelect
                          label={t('calls.type')}
                          placeholder={t('calls.select_type')}
                          value={value}
                          onChange={onChange}
                          options={callTypes.map((t) => ({ id: t.Id, name: t.Name }))}
                          error={errors.type?.message}
                          required
                        />
                      )}
                    />
                  </View>
                </View>

                <Controller
                  control={control}
                  name="note"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <WebInput label={t('calls.note')} placeholder={t('calls.note_placeholder')} value={value || ''} onChange={onChange} onBlur={onBlur} multiline rows={4} testID="note-input" />
                  )}
                />
              </Card>

              {/* Contact Information */}
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight])}>{t('calls.contact_information')}</Text>

                <View style={styles.twoInputRow}>
                  <View style={styles.halfWidth}>
                    <Controller
                      control={control}
                      name="contactName"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <WebInput label={t('calls.contact_name')} placeholder={t('calls.contact_name_placeholder')} value={value || ''} onChange={onChange} onBlur={onBlur} testID="contact-name-input" />
                      )}
                    />
                  </View>
                  <View style={styles.halfWidth}>
                    <Controller
                      control={control}
                      name="contactInfo"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <WebInput label={t('calls.contact_info')} placeholder={t('calls.contact_info_placeholder')} value={value || ''} onChange={onChange} onBlur={onBlur} testID="contact-info-input" />
                      )}
                    />
                  </View>
                </View>
              </Card>

              {/* Additional Fields (UDF) */}
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onPress={() => setIsAdditionalFieldsExpanded((prev) => !prev)}>
                  <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0 }])}>{t('calls.additional_fields', 'Additional Fields')}</Text>
                  <View>{isAdditionalFieldsExpanded ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
                </Pressable>
                {isAdditionalFieldsExpanded ? (
                  <View style={{ marginTop: 16 }}>
                    <UdfFieldsRenderer entityType={0} entityId={callId} onValuesChange={setUdfValues} isDark={isDark} />
                  </View>
                ) : null}
              </Card>
            </View>

            {/* Right Column - Location & Dispatch */}
            <View style={isWideScreen ? styles.rightColumn : styles.fullWidth}>
              {/* Location Card */}
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight])}>{t('calls.call_location')}</Text>

                <Controller
                  control={control}
                  name="address"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <WebInput
                      label={t('calls.address')}
                      placeholder={t('calls.address_placeholder')}
                      value={value || ''}
                      onChange={onChange}
                      onBlur={onBlur}
                      testID="address-input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddressSearch(value || '');
                        }
                      }}
                      rightElement={
                        <Pressable
                          onPress={() => handleAddressSearch(value || '')}
                          style={StyleSheet.flatten([styles.searchButton, isGeocodingAddress ? styles.searchButtonDisabled : {}])}
                          disabled={isGeocodingAddress || !value?.trim()}
                        >
                          {isGeocodingAddress ? <Text style={styles.searchButtonText}>...</Text> : <SearchIcon size={16} color={isDark ? '#fff' : '#000'} />}
                        </Pressable>
                      }
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="coordinates"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <WebInput label={t('calls.coordinates')} placeholder={t('calls.coordinates_placeholder')} value={value || ''} onChange={onChange} onBlur={onBlur} testID="coordinates-input" disabled />
                  )}
                />

                {/* Map Preview */}
                <View style={styles.mapContainer}>
                  {selectedLocation ? (
                    <View style={styles.mapWrapper}>
                      <LocationPicker initialLocation={selectedLocation} onLocationSelected={handleLocationSelected} height={200} />
                      <Pressable style={styles.expandMapButton} onPress={() => setShowLocationPicker(true)}>
                        <MapPinIcon size={16} color="#fff" />
                        <Text style={styles.expandMapText}>{t('calls.expand_map')}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable style={StyleSheet.flatten([styles.selectLocationButton, isDark ? styles.selectLocationButtonDark : styles.selectLocationButtonLight])} onPress={() => setShowLocationPicker(true)}>
                      <MapPinIcon size={24} color={isDark ? '#9ca3af' : '#6b7280'} />
                      <Text style={StyleSheet.flatten([styles.selectLocationText, isDark ? styles.selectLocationTextDark : styles.selectLocationTextLight])}>{t('calls.select_location')}</Text>
                    </Pressable>
                  )}
                </View>

                <Controller
                  control={control}
                  name="destinationPoiId"
                  render={({ field: { onChange, value } }) => (
                    <WebSelect
                      label={t('calls.destination_poi')}
                      placeholder={t('calls.select_destination_poi')}
                      value={value || NO_DESTINATION_VALUE}
                      onChange={(selectedValue) => onChange(selectedValue === NO_DESTINATION_VALUE ? '' : selectedValue)}
                      useIdValue
                      options={[
                        { id: NO_DESTINATION_VALUE, name: t('calls.no_destination') },
                        ...destinationPois.map((poi) => ({
                          id: poi.PoiId,
                          name: getPoiDestinationOptionLabel(poi),
                        })),
                      ]}
                    />
                  )}
                />
                {isLoadingDestinationPois ? <Text style={StyleSheet.flatten([styles.webLabel, isDark ? styles.webLabelDark : styles.webLabelLight, { marginTop: -4 }])}>{t('calls.loading_destination_pois')}</Text> : null}
                {!isLoadingDestinationPois && destinationPois.length === 0 ? (
                  <Text style={StyleSheet.flatten([styles.webLabel, isDark ? styles.webLabelDark : styles.webLabelLight, { marginTop: -4 }])}>{t('calls.no_destination_pois_available')}</Text>
                ) : null}
              </Card>

              {/* Dispatch Card */}
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight])}>{t('calls.dispatch_to')}</Text>
                <Pressable style={StyleSheet.flatten([styles.dispatchButton, isDark ? styles.dispatchButtonDark : styles.dispatchButtonLight])} onPress={() => setShowDispatchModal(true)}>
                  <Text style={StyleSheet.flatten([styles.dispatchButtonText, isDark ? styles.dispatchButtonTextDark : styles.dispatchButtonTextLight])}>{getDispatchSummary()}</Text>
                  <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                </Pressable>
              </Card>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable style={StyleSheet.flatten([styles.cancelButton, isDark ? styles.cancelButtonDark : styles.cancelButtonLight])} onPress={() => router.back()}>
              <Text style={StyleSheet.flatten([styles.cancelButtonText, isDark ? styles.cancelButtonTextDark : styles.cancelButtonTextLight])}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={StyleSheet.flatten([styles.submitButton, isSubmitting ? styles.submitButtonDisabled : {}])} onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
              <SaveIcon size={18} color="#fff" />
              <Text style={styles.submitButtonText}>{isSubmitting ? t('common.saving') : t('common.save')}</Text>
            </Pressable>
          </View>

          {/* Keyboard Shortcut Hint */}
          <View style={styles.shortcutHint}>
            <Text style={StyleSheet.flatten([styles.shortcutText, isDark ? styles.shortcutTextDark : styles.shortcutTextLight])}>{t('calls.edit_keyboard_shortcuts', 'Tip: Press Ctrl+S to save, Escape to cancel')}</Text>
          </View>
        </ScrollView>
      </View>

      {/* Full-screen location picker */}
      {showLocationPicker ? (
        <View style={styles.fullScreenOverlay}>
          <FullScreenLocationPicker initialLocation={selectedLocation || undefined} onLocationSelected={handleLocationSelected} onClose={() => setShowLocationPicker(false)} />
        </View>
      ) : null}

      {/* Dispatch selection modal */}
      <DispatchSelectionModal isVisible={showDispatchModal} onClose={() => setShowDispatchModal(false)} onConfirm={handleDispatchSelection} initialSelection={dispatchSelection} />

      {/* Address selection modal */}
      {showAddressSelection ? (
        <View style={styles.modalOverlay}>
          <View style={StyleSheet.flatten([styles.modalContent, isDark ? styles.modalContentDark : styles.modalContentLight])}>
            <View style={styles.modalHeader}>
              <Text style={StyleSheet.flatten([styles.modalTitle, isDark ? styles.modalTitleDark : styles.modalTitleLight])}>{t('calls.select_address')}</Text>
              <Pressable onPress={() => setShowAddressSelection(false)} style={styles.closeButton}>
                <XIcon size={24} color={isDark ? '#fff' : '#000'} />
              </Pressable>
            </View>
            <ScrollView style={styles.addressList}>
              {addressResults.map((result, index) => (
                <Pressable key={result.place_id || index} style={StyleSheet.flatten([styles.addressItem, isDark ? styles.addressItemDark : styles.addressItemLight])} onPress={() => handleAddressSelected(result)}>
                  <MapPinIcon size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                  <Text style={StyleSheet.flatten([styles.addressItemText, isDark ? styles.addressItemTextDark : styles.addressItemTextLight])} numberOfLines={2}>
                    {result.formatted_address}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  containerDark: {
    backgroundColor: '#0a0a0a',
  },
  containerLight: {
    backgroundColor: '#fafafa',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    maxWidth: 1400,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 24,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  callNumber: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  callNumberDark: {
    color: '#9ca3af',
  },
  callNumberLight: {
    color: '#6b7280',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  titleDark: {
    color: '#ffffff',
  },
  titleLight: {
    color: '#111827',
  },
  unsavedBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unsavedBadgeText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
  },
  subtitleDark: {
    color: '#9ca3af',
  },
  subtitleLight: {
    color: '#6b7280',
  },
  twoColumnLayout: {
    flexDirection: 'row',
    gap: 24,
  },
  singleColumnLayout: {
    flexDirection: 'column',
    gap: 16,
  },
  leftColumn: {
    flex: 1,
    gap: 16,
  },
  rightColumn: {
    flex: 1,
    gap: 16,
  },
  fullWidth: {
    width: '100%',
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
  },
  cardDark: {
    backgroundColor: '#171717',
    borderColor: '#262626',
  },
  cardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionTitleDark: {
    color: '#ffffff',
  },
  sectionTitleLight: {
    color: '#111827',
  },
  webInputContainer: {
    marginBottom: 16,
  },
  webLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  webLabelDark: {
    color: '#d1d5db',
  },
  webLabelLight: {
    color: '#374151',
  },
  required: {
    color: '#ef4444',
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  webInputDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
    color: '#ffffff',
  },
  webInputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    color: '#111827',
  },
  webInputError: {
    borderColor: '#ef4444',
  },
  rightElement: {
    position: 'absolute',
    right: 8,
  },
  webSelectDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
    color: '#ffffff',
  },
  webSelectLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
    color: '#111827',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  twoInputRow: {
    flexDirection: 'row',
    gap: 16,
  },
  halfWidth: {
    flex: 1,
  },
  searchButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    fontSize: 12,
  },
  mapContainer: {
    marginTop: 8,
  },
  mapWrapper: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  expandMapButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  expandMapText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  selectLocationButton: {
    height: 160,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  selectLocationButtonDark: {
    borderColor: '#404040',
    backgroundColor: '#1a1a1a',
  },
  selectLocationButtonLight: {
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  selectLocationText: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectLocationTextDark: {
    color: '#9ca3af',
  },
  selectLocationTextLight: {
    color: '#6b7280',
  },
  dispatchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  dispatchButtonDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
  },
  dispatchButtonLight: {
    backgroundColor: '#ffffff',
    borderColor: '#d1d5db',
  },
  dispatchButtonText: {
    fontSize: 14,
  },
  dispatchButtonTextDark: {
    color: '#d1d5db',
  },
  dispatchButtonTextLight: {
    color: '#374151',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonDark: {
    borderColor: '#404040',
    backgroundColor: 'transparent',
  },
  cancelButtonLight: {
    borderColor: '#d1d5db',
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButtonTextDark: {
    color: '#d1d5db',
  },
  cancelButtonTextLight: {
    color: '#374151',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#2563eb',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  shortcutHint: {
    marginTop: 16,
    alignItems: 'center',
  },
  shortcutText: {
    fontSize: 12,
  },
  shortcutTextDark: {
    color: '#6b7280',
  },
  shortcutTextLight: {
    color: '#9ca3af',
  },
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalContentDark: {
    backgroundColor: '#171717',
  },
  modalContentLight: {
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalTitleDark: {
    color: '#ffffff',
  },
  modalTitleLight: {
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  addressList: {
    maxHeight: 400,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
  },
  addressItemDark: {
    borderBottomColor: '#262626',
  },
  addressItemLight: {
    borderBottomColor: '#f3f4f6',
  },
  addressItemText: {
    flex: 1,
    fontSize: 14,
  },
  addressItemTextDark: {
    color: '#d1d5db',
  },
  addressItemTextLight: {
    color: '#374151',
  },
});

// Web-specific styles that use CSS-only properties
const webStyles: { [key: string]: React.CSSProperties } = {
  webInput: {
    width: '100%',
    padding: 10,
    paddingRight: 40,
    fontSize: 14,
    borderRadius: 8,
    borderWidth: 1,
    outline: 'none',
  },
  webInputDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  webSelect: {
    width: '100%',
    padding: 10,
    fontSize: 14,
    borderRadius: 8,
    borderWidth: 1,
    outline: 'none',
    cursor: 'pointer',
  },
};
