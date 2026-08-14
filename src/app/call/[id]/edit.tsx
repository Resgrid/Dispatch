import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, SearchIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import * as z from 'zod';

import { getNewCallData } from '@/api/dispatch/dispatch';
import { forwardGeocode } from '@/api/geocoding/geocoding';
import { saveUdfValues } from '@/api/userDefinedFields/userDefinedFields';
import { DispatchSelectionModal } from '@/components/calls/dispatch-selection-modal';
import { UdfFieldsRenderer } from '@/components/calls/udf-fields-renderer';
import { Loading } from '@/components/common/loading';
import FullScreenLocationPicker from '@/components/maps/full-screen-location-picker';
import LocationPicker from '@/components/maps/location-picker';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormControl, FormControlError, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { useAnalytics } from '@/hooks/use-analytics';
import { getPoiDestinationOptionLabel } from '@/lib/poi-display';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type UdfFieldValueInput } from '@/models/v4/userDefinedFields/udfFieldValueInput';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallDetailStore } from '@/stores/calls/detail-store';
import { useCallsStore } from '@/stores/calls/store';
import { type DispatchSelection } from '@/stores/dispatch/store';

// Form validation schema (same as New Call)
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
  notifyCancelledEntities: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const NO_DESTINATION_VALUE = '__none__';

interface GeocodingResult {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

interface GeocodingResponse {
  results: GeocodingResult[];
  status: string;
}

export default function EditCall() {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useColorScheme();
  const { id } = useLocalSearchParams();
  const callId = Array.isArray(id) ? id[0] : id;
  const { callPriorities, callTypes, isLoading: callDataLoading, error: callDataError, fetchCallPriorities, fetchCallTypes } = useCallsStore();
  const { call, callExtraData, isLoading: callDetailLoading, error: callDetailError, fetchCallDetail } = useCallDetailStore();
  const { config } = useCoreStore();
  const toast = useToast();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showAddressSelection, setShowAddressSelection] = useState(false);
  const [udfValues, setUdfValues] = useState<UdfFieldValueInput[]>([]);
  const [isAdditionalFieldsExpanded, setIsAdditionalFieldsExpanded] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isGeocodingPlusCode, setIsGeocodingPlusCode] = useState(false);
  const [isGeocodingCoordinates, setIsGeocodingCoordinates] = useState(false);
  const [isGeocodingWhat3Words, setIsGeocodingWhat3Words] = useState(false);
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

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
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
      notifyCancelledEntities: false,
    },
  });

  useEffect(() => {
    fetchCallPriorities();
    fetchCallTypes();
    if (callId) {
      fetchCallDetail(callId);
    }
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

      // Set selected location if coordinates exist
      if (call.Latitude && call.Longitude) {
        setSelectedLocation({
          latitude: parseFloat(call.Latitude),
          longitude: parseFloat(call.Longitude),
          address: call.Address || undefined,
        });
      }
    }
  }, [call, callExtraData, callPriorities, callTypes, reset]);

  // Track when edit call view is rendered
  useEffect(() => {
    if (call) {
      trackEvent('edit_call_view_rendered', {
        callId: call.CallId || '',
        callName: call.Name || '',
        callPriority: call.Priority || 0,
        callType: call.Type || '',
        hasCoordinates: !!(call.Latitude && call.Longitude),
        hasAddress: !!call.Address,
      });
    }
  }, [trackEvent, call]);

  const onSubmit = async (data: FormValues) => {
    try {
      // If we have latitude and longitude, add them to the data
      if (selectedLocation?.latitude && selectedLocation?.longitude) {
        data.latitude = selectedLocation.latitude;
        data.longitude = selectedLocation.longitude;
      }

      console.log('Updating call with data:', data);

      const priority = callPriorities.find((p) => p.Name === data.priority);
      const type = callTypes.find((t) => t.Name === data.type);

      // Update the call using the store
      await useCallDetailStore.getState().updateCall({
        callId: callId!,
        name: data.name,
        nature: data.nature,
        priority: priority?.Id || 0,
        type: type?.Name || '',
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
        notifyCancelledEntities: data.notifyCancelledEntities,
      });

      if (udfValues.length > 0 && callId) {
        try {
          await saveUdfValues(0, callId, udfValues);
        } catch (udfError) {
          console.warn('Failed to save UDF values:', udfError);
        }
      }

      // Show success toast
      toast.show({
        placement: 'top',
        render: () => {
          return (
            <Box className="rounded-lg bg-green-500 p-4 shadow-lg">
              <Text className="text-white">{t('call_detail.update_call_success')}</Text>
            </Box>
          );
        },
      });

      // Navigate back to call detail
      router.back();
    } catch (error) {
      console.error('Error updating call:', error);

      // Show error toast
      toast.show({
        placement: 'top',
        render: () => {
          return (
            <Box className="rounded-lg bg-red-500 p-4 shadow-lg">
              <Text className="text-white">{t('call_detail.update_call_error')}</Text>
            </Box>
          );
        },
      });
    }
  };

  const handleLocationSelected = (location: { latitude: number; longitude: number; address?: string }) => {
    setSelectedLocation(location);
    setValue('latitude', location.latitude);
    setValue('longitude', location.longitude);
    if (location.address) {
      setValue('address', location.address);
    }
    setShowLocationPicker(false);
  };

  const handleDispatchSelection = (selection: DispatchSelection) => {
    setDispatchSelection(selection);
    setValue('dispatchSelection', selection);
    setShowDispatchModal(false);
  };

  const getDispatchSummary = () => {
    if (dispatchSelection.everyone) {
      return t('calls.everyone');
    }

    const totalSelected = dispatchSelection.users.length + dispatchSelection.groups.length + dispatchSelection.roles.length + dispatchSelection.units.length;

    if (totalSelected === 0) {
      return t('calls.select_recipients');
    }

    return `${totalSelected} ${t('calls.selected')}`;
  };

  // Address search functionality (same as New Call)
  const handleAddressSearch = async (address: string) => {
    if (!address.trim()) {
      toast.show({
        placement: 'top',
        render: () => {
          return (
            <Box className="rounded-lg bg-orange-500 p-4 shadow-lg">
              <Text className="text-white">{t('calls.address_required')}</Text>
            </Box>
          );
        },
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
          const newLocation = {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            address: result.formatted_address,
          };

          handleLocationSelected(newLocation);

          toast.show({
            placement: 'top',
            render: () => {
              return (
                <Box className="rounded-lg bg-green-500 p-4 shadow-lg">
                  <Text className="text-white">{t('calls.address_found')}</Text>
                </Box>
              );
            },
          });
        } else {
          setAddressResults(results);
          setShowAddressSelection(true);
        }
      } else {
        toast.show({
          placement: 'top',
          render: () => {
            return (
              <Box className="rounded-lg bg-red-500 p-4 shadow-lg">
                <Text className="text-white">{t('calls.address_not_found')}</Text>
              </Box>
            );
          },
        });
      }
    } catch (error) {
      console.error('Error geocoding address:', error);

      toast.show({
        placement: 'top',
        render: () => {
          return (
            <Box className="rounded-lg bg-red-500 p-4 shadow-lg">
              <Text className="text-white">{t('calls.geocoding_error')}</Text>
            </Box>
          );
        },
      });
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  const handleAddressSelected = (result: GeocodingResult) => {
    const newLocation = {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      address: result.formatted_address,
    };

    handleLocationSelected(newLocation);
    setShowAddressSelection(false);

    toast.show({
      placement: 'top',
      render: () => {
        return (
          <Box className="rounded-lg bg-green-500 p-4 shadow-lg">
            <Text className="text-white">{t('calls.address_found')}</Text>
          </Box>
        );
      },
    });
  };

  if (callDetailLoading || callDataLoading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('calls.edit_call'),
            headerShown: true,
            headerBackTitle: '',
          }}
        />
        <Loading />
      </>
    );
  }

  if (callDetailError || callDataError || !call) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('calls.edit_call'),
            headerShown: true,
            headerBackTitle: '',
          }}
        />
        <View className="size-full flex-1">
          <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
            <Text className="error text-center">{callDetailError || callDataError || 'Call not found'}</Text>
          </Box>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('calls.edit_call'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <View className="size-full flex-1">
        <Box className={`size-full w-full flex-1 ${colorScheme === 'dark' ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
          <ScrollView className="flex-1 px-4 py-6">
            <Text className="mb-6 text-2xl font-bold">{t('calls.edit_call_description')}</Text>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl isInvalid={!!errors.name}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.name')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="name"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.name_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
                {errors.name && (
                  <FormControlError>
                    <Text className="text-red-500">{errors.name.message}</Text>
                  </FormControlError>
                )}
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl isInvalid={!!errors.nature}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.nature')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="nature"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Textarea>
                      <TextareaInput value={value} onChangeText={onChange} onBlur={onBlur} numberOfLines={4} placeholder={t('calls.nature_placeholder')} />
                    </Textarea>
                  )}
                />
                {errors.nature && (
                  <FormControlError>
                    <Text className="text-red-500">{errors.nature.message}</Text>
                  </FormControlError>
                )}
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl isInvalid={!!errors.priority}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.priority')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="priority"
                  render={({ field: { onChange, value } }) => (
                    <Select selectedValue={value} onValueChange={onChange}>
                      <SelectTrigger>
                        <SelectInput placeholder={t('calls.priority_placeholder')} />
                        <SelectIcon as={ChevronDownIcon} />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                          {callPriorities.map((priority) => (
                            <SelectItem key={priority.Id} label={priority.Name} value={priority.Name} />
                          ))}
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  )}
                />
                {errors.priority && (
                  <FormControlError>
                    <Text className="text-red-500">{errors.priority.message}</Text>
                  </FormControlError>
                )}
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl isInvalid={!!errors.type}>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.type')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="type"
                  render={({ field: { onChange, value } }) => (
                    <Select selectedValue={value} onValueChange={onChange}>
                      <SelectTrigger>
                        <SelectInput placeholder={t('calls.select_type')} />
                        <SelectIcon as={ChevronDownIcon} />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                          {callTypes.map((type) => (
                            <SelectItem key={type.Id} label={type.Name} value={type.Name} />
                          ))}
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  )}
                />
                {errors.type && (
                  <FormControlError>
                    <Text className="text-red-500">{errors.type.message}</Text>
                  </FormControlError>
                )}
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.note')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="note"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Textarea>
                      <TextareaInput value={value} onChangeText={onChange} onBlur={onBlur} numberOfLines={4} placeholder={t('calls.note_placeholder')} />
                    </Textarea>
                  )}
                />
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <Text className="mb-4 text-lg font-semibold">{t('calls.call_location')}</Text>

              {/* Address Field */}
              <FormControl className="mb-4">
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.address')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="address"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Box className="flex-row items-center space-x-2">
                      <Box className="flex-1">
                        <Input>
                          <InputField testID="address-input" placeholder={t('calls.address_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                        </Input>
                      </Box>
                      <Button testID="address-search-button" size="sm" variant="outline" className="ml-2" onPress={() => handleAddressSearch(value || '')} disabled={isGeocodingAddress || !value?.trim()}>
                        {isGeocodingAddress ? <Text>...</Text> : <SearchIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#000000'} />}
                      </Button>
                    </Box>
                  )}
                />
              </FormControl>

              {/* Map Preview */}
              <Box className="mb-4">
                {selectedLocation ? (
                  <LocationPicker initialLocation={selectedLocation} onLocationSelected={handleLocationSelected} height={200} />
                ) : (
                  <Button onPress={() => setShowLocationPicker(true)} className="w-full">
                    <ButtonText>{t('calls.select_location')}</ButtonText>
                  </Button>
                )}
              </Box>

              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.destination_poi')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="destinationPoiId"
                  render={({ field: { onChange, value } }) => (
                    <Select selectedValue={value || NO_DESTINATION_VALUE} onValueChange={(selectedValue) => onChange(selectedValue === NO_DESTINATION_VALUE ? '' : selectedValue)}>
                      <SelectTrigger>
                        <SelectInput placeholder={t('calls.select_destination_poi')} />
                        <SelectIcon as={ChevronDownIcon} />
                      </SelectTrigger>
                      <SelectPortal>
                        <SelectBackdrop />
                        <SelectContent>
                          <SelectItem label={t('calls.no_destination')} value={NO_DESTINATION_VALUE} />
                          {destinationPois.map((poi) => (
                            <SelectItem key={poi.PoiId} label={getPoiDestinationOptionLabel(poi)} value={poi.PoiId.toString()} />
                          ))}
                        </SelectContent>
                      </SelectPortal>
                    </Select>
                  )}
                />
                {isLoadingDestinationPois ? <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('calls.loading_destination_pois')}</Text> : null}
                {!isLoadingDestinationPois && destinationPois.length === 0 ? <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('calls.no_destination_pois_available')}</Text> : null}
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.contact_name')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="contactName"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.contact_name_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
              </FormControl>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <FormControl>
                <FormControlLabel>
                  <FormControlLabelText>{t('calls.contact_info')}</FormControlLabelText>
                </FormControlLabel>
                <Controller
                  control={control}
                  name="contactInfo"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input>
                      <InputField placeholder={t('calls.contact_info_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    </Input>
                  )}
                />
              </FormControl>
            </Card>

            {/* Additional Fields (UDF) */}
            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <TouchableOpacity className="flex-row items-center justify-between" onPress={() => setIsAdditionalFieldsExpanded((prev) => !prev)}>
                <Text className="text-lg font-semibold">{t('calls.additional_fields', 'Additional Fields')}</Text>
                {isAdditionalFieldsExpanded ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
              </TouchableOpacity>
              {isAdditionalFieldsExpanded ? (
                <View className="mt-4">
                  <UdfFieldsRenderer entityType={0} entityId={callId} onValuesChange={setUdfValues} isDark={colorScheme === 'dark'} />
                </View>
              ) : null}
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <Text className="mb-4 text-lg font-semibold">{t('calls.dispatch_to')}</Text>
              <Button onPress={() => setShowDispatchModal(true)} className="w-full">
                <ButtonText>{getDispatchSummary()}</ButtonText>
              </Button>
            </Card>

            <Card className={`mb-8 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
              <View className="flex-row items-center justify-between">
                <View className="mr-3 flex-1">
                  <Text className="text-base font-semibold">{t('calls.notify_cancelled_entities')}</Text>
                  <Text className="text-sm text-gray-500">{t('calls.notify_cancelled_entities_description')}</Text>
                </View>
                <Controller control={control} name="notifyCancelledEntities" render={({ field: { onChange, value } }) => <Switch size="md" value={!!value} onValueChange={onChange} />} />
              </View>
            </Card>

            <Box className="mb-6 flex-row space-x-4">
              <Button className="mr-10 flex-1" variant="outline" onPress={() => router.back()}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button className="ml-10 flex-1" variant="solid" action="primary" onPress={handleSubmit(onSubmit)}>
                <ButtonText>{t('common.save')}</ButtonText>
              </Button>
            </Box>
          </ScrollView>
        </Box>
      </View>

      {/* Full-screen location picker overlay */}
      {showLocationPicker && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
          }}
        >
          <FullScreenLocationPicker
            key={showLocationPicker ? 'location-picker-open' : 'location-picker-closed'}
            initialLocation={selectedLocation || undefined}
            onLocationSelected={handleLocationSelected}
            onClose={() => setShowLocationPicker(false)}
          />
        </View>
      )}

      {/* Dispatch selection modal */}
      <DispatchSelectionModal isVisible={showDispatchModal} onClose={() => setShowDispatchModal(false)} onConfirm={handleDispatchSelection} initialSelection={dispatchSelection} />

      {/* Address selection bottom sheet */}
      <CustomBottomSheet isOpen={showAddressSelection} onClose={() => setShowAddressSelection(false)} isLoading={false}>
        <Box className="p-4">
          <Text className="mb-4 text-center text-lg font-semibold">{t('calls.select_address')}</Text>
          <ScrollView className="max-h-96">
            {addressResults.map((result, index) => (
              <Button key={result.place_id || index} variant="outline" className="mb-2 w-full" onPress={() => handleAddressSelected(result)}>
                <ButtonText className="flex-1 text-left" numberOfLines={2}>
                  {result.formatted_address}
                </ButtonText>
              </Button>
            ))}
          </ScrollView>
        </Box>
      </CustomBottomSheet>
    </>
  );
}
