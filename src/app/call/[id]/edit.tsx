import { zodResolver } from '@hookform/resolvers/zod';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { BookOpenIcon, ChevronDownIcon, ChevronUpIcon, LinkIcon, PlusIcon, SearchIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import * as z from 'zod';

import { getNewCallData } from '@/api/dispatch/dispatch';
import { forwardGeocode, plusCodeLookup, what3WordsLookup } from '@/api/geocoding/geocoding';
import { saveUdfValues } from '@/api/userDefinedFields/userDefinedFields';
import { DispatchSelectionModal } from '@/components/calls/dispatch-selection-modal';
import { LinkedCallsModal } from '@/components/calls/linked-calls-modal';
import { ProtocolSelectorModal, type SelectedProtocol } from '@/components/calls/protocol-selector-modal';
import { UdfFieldsRenderer } from '@/components/calls/udf-fields-renderer';
import { DateTimeField } from '@/components/common/date-time-field';
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
import { useNewCallFieldPolicy } from '@/hooks/use-new-call-field-policy';
import { describeCallFields, getEditCallMissingFields, getMissingCallFieldsFromError, keepHiddenEditFieldsUnchanged, toProtocolIds } from '@/lib/call-field-policy';
import { getScheduledDispatchPrefill, isDispatchTimeTooSoon, toDispatchOnUtc } from '@/lib/call-schedule';
import { getPoiDestinationOptionLabel } from '@/lib/poi-display';
import { isCallPending } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type NewCallFieldKey, NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';
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
  externalId: z.string().optional(),
  incidentId: z.string().optional(),
  referenceId: z.string().optional(),
  // New dispatch time, as the picker's ISO UTC instant. Pre-filled only while the call is still scheduled.
  dispatchOn: z.string().optional(),
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
  const { callPriorities, callTypes, isLoadingPriorities, isLoadingTypes, prioritiesError, typesError, fetchCallPriorities, fetchCallTypes } = useCallsStore();
  // Only the first load of priorities and types holds the form back. The store's shared isLoading/error also follow
  // the active-calls list, which reloads on every call event, so gating on them blanked the form while it was in use.
  const callDataLoading = (isLoadingPriorities && callPriorities.length === 0) || (isLoadingTypes && callTypes.length === 0);
  const callDataError = callPriorities.length === 0 ? prioritiesError : callTypes.length === 0 ? typesError : null;
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
  // Protocols and a linked call this edit adds. EditCall keeps what the call already has and cannot
  // remove either, so these start empty rather than pre-filled from the call.
  const [selectedProtocols, setSelectedProtocols] = useState<SelectedProtocol[]>([]);
  const [linkedCall, setLinkedCall] = useState<{ callId: string; number: string; name: string } | null>(null);
  // The dispatch time the form started with. Only a different one is sent (and checked), so saving other
  // changes to a scheduled call neither resends its time nor trips the lead-time rule as it gets closer.
  const [initialDispatchOn, setInitialDispatchOn] = useState('');
  const [showProtocolSelector, setShowProtocolSelector] = useState(false);
  const [showLinkedCallsModal, setShowLinkedCallsModal] = useState(false);

  // The department's call field policy applies to edits too: hidden fields are not offered (and keep
  // their stored value), required ones must still have a value once the edit is saved.
  const fieldPolicy = useNewCallFieldPolicy();

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
      externalId: '',
      incidentId: '',
      referenceId: '',
      dispatchOn: '',
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
      // Call.Type is the type's text, not its id -- matching on Id left the picker blank on every edit.
      const type = callTypes.find((t) => t.Name === call.Type);

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

      // The stored dispatch time, while it is still ahead; a call that already went out starts blank.
      const scheduledDispatchOn = getScheduledDispatchPrefill(call.DispatchedOnUtc);
      setInitialDispatchOn(scheduledDispatchOn);

      reset({
        name: call.Name || '',
        nature: call.Nature || '',
        note: call.Note || '',
        destinationPoiId: call.DestinationPoiId ? call.DestinationPoiId.toString() : '',
        address: call.Address || '',
        coordinates: call.Geolocation || '',
        what3words: call.What3Words || '',
        // Never stored on a call: it only locates the call while it is entered.
        plusCode: '',
        latitude: call.Latitude ? parseFloat(call.Latitude) : undefined,
        longitude: call.Longitude ? parseFloat(call.Longitude) : undefined,
        priority: priority?.Name || '',
        type: type?.Name || '',
        contactName: call.ContactName || '',
        contactInfo: call.ContactInfo || '',
        externalId: call.ExternalId || '',
        incidentId: call.IncidentId || '',
        referenceId: call.ReferenceId || '',
        dispatchOn: scheduledDispatchOn,
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

  const showErrorToast = (message: string) => {
    toast.show({
      placement: 'top',
      render: () => {
        return (
          <Box className="rounded-lg bg-red-500 p-4 shadow-lg">
            <Text className="text-white">{message}</Text>
          </Box>
        );
      },
    });
  };

  const onSubmit = async (data: FormValues) => {
    if (!call) {
      return;
    }

    // The policy arrives asynchronously and reads as "nothing required" until it lands; hold the save
    // back rather than skip every requirement. Fail-open only applies once the lookup has finished.
    if (!fieldPolicy.isLoaded) {
      showErrorToast(t('calls.field_policy_loading'));
      return;
    }

    try {
      // If we have latitude and longitude, add them to the data
      if (selectedLocation?.latitude && selectedLocation?.longitude) {
        data.latitude = selectedLocation.latitude;
        data.longitude = selectedLocation.longitude;
      }

      const destinationPoiId = data.destinationPoiId ? Number(data.destinationPoiId) : null;
      const addedProtocolIds = toProtocolIds(selectedProtocols);

      // Checked against the call as this save leaves it, the way EditCall checks it, so a field the
      // department requires cannot be emptied by an edit. The server enforces the same rules.
      const missingFields = getEditCallMissingFields(
        fieldPolicy.missingRequired,
        {
          note: data.note,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          what3words: data.what3words,
          plusCode: data.plusCode,
          contactName: data.contactName,
          contactInfo: data.contactInfo,
          externalId: data.externalId,
          incidentId: data.incidentId,
          referenceId: data.referenceId,
          destinationPoiId,
          dispatch: data.dispatchSelection,
          addedProtocolIds,
          storedProtocolCount: callExtraData ? (callExtraData.Protocols?.length ?? 0) : null,
          linkedCallId: linkedCall?.callId,
        },
        call
      );

      if (missingFields.length > 0) {
        showErrorToast(t('calls.required_fields_missing_edit', { fields: describeCallFields(missingFields, t) }));
        return;
      }

      // A newly picked dispatch time has to be far enough ahead to be worth scheduling. Clearing the
      // field sends nothing, which keeps the call's schedule (EditCall cannot remove one).
      const dispatchOnChanged = !!data.dispatchOn && data.dispatchOn !== initialDispatchOn;

      if (dispatchOnChanged && isDispatchTimeTooSoon(data.dispatchOn)) {
        showErrorToast(t('calls.scheduled_on_too_soon'));
        return;
      }

      const priority = callPriorities.find((p) => p.Name === data.priority);
      const type = callTypes.find((t) => t.Name === data.type);

      // Update the call using the store. A field the policy hides goes up as "unchanged", so the
      // value the call already has is kept rather than overwritten by an input nobody could see.
      await useCallDetailStore.getState().updateCall(
        keepHiddenEditFieldsUnchanged(
          {
            callId: callId!,
            name: data.name,
            nature: data.nature,
            priority: priority?.Id || 0,
            type: type?.Name || '',
            note: data.note,
            destinationPoiId,
            address: data.address,
            latitude: data.latitude,
            longitude: data.longitude,
            what3words: data.what3words,
            plusCode: data.plusCode,
            contactName: data.contactName,
            contactInfo: data.contactInfo,
            externalId: data.externalId,
            incidentId: data.incidentId,
            referenceId: data.referenceId,
            dispatchOnUtc: dispatchOnChanged ? toDispatchOnUtc(data.dispatchOn) : undefined,
            // Added to the call; blank/empty still goes up so the server checks the requirement.
            protocolIds: addedProtocolIds,
            linkedCallId: linkedCall?.callId ?? '',
            dispatchUsers: data.dispatchSelection?.users,
            dispatchGroups: data.dispatchSelection?.groups,
            dispatchRoles: data.dispatchSelection?.roles,
            dispatchUnits: data.dispatchSelection?.units,
            dispatchEveryone: data.dispatchSelection?.everyone,
            notifyCancelledEntities: data.notifyCancelledEntities,
          },
          fieldPolicy.isVisible,
          call
        )
      );

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

      // The server refuses an edit that would leave a required field blank and names the fields (it
      // also sees what this screen cannot, such as the links already on the call).
      const missingOnServer = getMissingCallFieldsFromError(error);

      showErrorToast(missingOnServer ? t('calls.required_fields_missing_edit', { fields: describeCallFields(missingOnServer, t) }) : t('call_detail.update_call_error'));
    }
  };

  const handleLinkedCallSelect = (selected: CallResultData) => {
    setLinkedCall({ callId: selected.CallId, number: selected.Number, name: selected.Name });
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
        // The lookup running and matching nothing is a different problem to the lookup failing.
        toast.show({
          placement: 'top',
          render: () => {
            return (
              <Box className="rounded-lg bg-red-500 p-4 shadow-lg">
                <Text className="text-white">{t(lookup.succeeded ? 'calls.address_not_found' : 'calls.geocoding_error')}</Text>
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

  const showToast = (className: string, message: string) => {
    toast.show({
      placement: 'top',
      render: () => {
        return (
          <Box className={`rounded-lg ${className} p-4 shadow-lg`}>
            <Text className="text-white">{message}</Text>
          </Box>
        );
      },
    });
  };

  // what3words search (same as New Call): the three words locate the call and are stored on it.
  const handleWhat3WordsSearch = async (what3words: string) => {
    if (!what3words.trim()) {
      showToast('bg-orange-500', t('calls.what3words_required'));
      return;
    }

    if (!/^[a-z]+\.[a-z]+\.[a-z]+$/.test(what3words.trim().toLowerCase())) {
      showToast('bg-orange-500', t('calls.what3words_invalid_format'));
      return;
    }

    setIsGeocodingWhat3Words(true);
    try {
      const lookup = await what3WordsLookup(what3words);

      if (lookup.candidates.length > 0) {
        const result = lookup.candidates[0];
        handleLocationSelected({ latitude: result.geometry.location.lat, longitude: result.geometry.location.lng, address: result.formatted_address });
        showToast('bg-green-500', t('calls.what3words_found'));
      } else {
        showToast('bg-red-500', t(lookup.succeeded ? 'calls.what3words_not_found' : 'calls.what3words_geocoding_error'));
      }
    } catch (error) {
      console.error('Error geocoding what3words:', error);
      showToast('bg-red-500', t('calls.what3words_geocoding_error'));
    } finally {
      setIsGeocodingWhat3Words(false);
    }
  };

  // Plus code search (same as New Call): locates the call; the code itself is not stored.
  const handlePlusCodeSearch = async (plusCode: string) => {
    if (!plusCode.trim()) {
      showToast('bg-orange-500', t('calls.plus_code_required'));
      return;
    }

    setIsGeocodingPlusCode(true);
    try {
      const lookup = await plusCodeLookup(plusCode);

      if (lookup.candidates.length > 0) {
        const result = lookup.candidates[0];
        handleLocationSelected({ latitude: result.geometry.location.lat, longitude: result.geometry.location.lng, address: result.formatted_address });
        showToast('bg-green-500', t('calls.plus_code_found'));
      } else {
        showToast('bg-red-500', t(lookup.succeeded ? 'calls.plus_code_not_found' : 'calls.plus_code_geocoding_error'));
      }
    } catch (error) {
      console.error('Error geocoding plus code:', error);
      showToast('bg-red-500', t('calls.plus_code_geocoding_error'));
    } finally {
      setIsGeocodingPlusCode(false);
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

  // Every field the department's policy controls drives its own control, as on the new-call screen.
  const showNote = fieldPolicy.isVisible(NewCallFieldKeys.Note);
  const showAddress = fieldPolicy.isVisible(NewCallFieldKeys.Address);
  const showGeolocation = fieldPolicy.isVisible(NewCallFieldKeys.Geolocation);
  const showDestinationPoi = fieldPolicy.isVisible(NewCallFieldKeys.DestinationPoi);
  const showWhat3Words = fieldPolicy.isVisible(NewCallFieldKeys.What3Words);
  const showPlusCode = fieldPolicy.isVisible(NewCallFieldKeys.PlusCode);
  const showLocationCard = showAddress || showGeolocation || showWhat3Words || showPlusCode || showDestinationPoi;
  const showExternalId = fieldPolicy.isVisible(NewCallFieldKeys.ExternalId);
  const showIncidentId = fieldPolicy.isVisible(NewCallFieldKeys.IncidentId);
  const showReferenceId = fieldPolicy.isVisible(NewCallFieldKeys.ReferenceId);
  const showContactName = fieldPolicy.isVisible(NewCallFieldKeys.ContactName);
  const showContactInfo = fieldPolicy.isVisible(NewCallFieldKeys.ContactInfo);
  const showProtocols = fieldPolicy.isVisible(NewCallFieldKeys.Protocols);
  const showLinkedCall = fieldPolicy.isVisible(NewCallFieldKeys.LinkedCall);
  const showDispatchList = fieldPolicy.isVisible(NewCallFieldKeys.DispatchList);
  // A pending call's recipients are decided when it is dispatched, so they are not required here.
  const isPendingCall = isCallPending(call.State);
  const attachedProtocols = callExtraData?.Protocols ?? [];
  // Labelled inputs get the form control's own asterisk; section titles get this one.
  const requiredMark = (key: NewCallFieldKey) => (fieldPolicy.isRequired(key) ? <Text className="text-red-500"> *</Text> : null);

  // A location lookup input with its search button (what3words, plus code), as on the new-call screen.
  const renderLookupField = (name: 'what3words' | 'plusCode', key: NewCallFieldKey, label: string, placeholder: string, testID: string, isSearching: boolean, onSearch: (value: string) => void) => (
    <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(key)}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <Box className="flex-row items-center space-x-2">
            <Box className="flex-1">
              <Input>
                <InputField testID={`${testID}-input`} placeholder={placeholder} value={value} onChangeText={onChange} onBlur={onBlur} />
              </Input>
            </Box>
            <Button testID={`${testID}-search-button`} size="sm" variant="outline" className="ml-2" onPress={() => onSearch(value || '')} disabled={isSearching || !value?.trim()}>
              {isSearching ? <Text>...</Text> : <SearchIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#000000'} />}
            </Button>
          </Box>
        )}
      />
    </FormControl>
  );

  // The call's own identifiers: plain text inputs, each gated and marked by the policy.
  const renderIdentifierField = (name: 'externalId' | 'incidentId' | 'referenceId', key: NewCallFieldKey, label: string, testID: string) => (
    <FormControl className="mb-3" isRequired={fieldPolicy.isRequired(key)}>
      <FormControlLabel>
        <FormControlLabelText>{label}</FormControlLabelText>
      </FormControlLabel>
      <Controller
        control={control}
        name={name}
        render={({ field: { onChange, onBlur, value } }) => (
          <Input>
            <InputField testID={testID} placeholder={label} value={value} onChangeText={onChange} onBlur={onBlur} />
          </Input>
        )}
      />
    </FormControl>
  );

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
        <Box className="size-full w-full flex-1 bg-gray-50 dark:bg-gray-900">
          <ScrollView className="flex-1 px-4 py-6">
            <Text className="mb-6 text-2xl font-bold">{t('calls.edit_call_description')}</Text>

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
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

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
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

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
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

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
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

            {showNote ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.Note)}>
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
            ) : null}

            {showLocationCard ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <Text className="mb-4 text-lg font-semibold">{t('calls.call_location')}</Text>

                {/* Address Field */}
                {showAddress ? (
                  <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.Address)}>
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
                ) : null}

                {showWhat3Words
                  ? renderLookupField('what3words', NewCallFieldKeys.What3Words, t('calls.what3words'), t('calls.what3words_placeholder'), 'what3words', isGeocodingWhat3Words, handleWhat3WordsSearch)
                  : null}
                {showPlusCode ? renderLookupField('plusCode', NewCallFieldKeys.PlusCode, t('calls.plus_code'), t('calls.plus_code_placeholder'), 'plus-code', isGeocodingPlusCode, handlePlusCodeSearch) : null}

                {/* Map Preview — the map is how a dispatcher sets the geolocation. */}
                {showGeolocation ? (
                  <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.Geolocation)}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.coordinates')}</FormControlLabelText>
                    </FormControlLabel>
                    {selectedLocation ? (
                      <LocationPicker initialLocation={selectedLocation} onLocationSelected={handleLocationSelected} height={200} />
                    ) : (
                      <Button onPress={() => setShowLocationPicker(true)} className="w-full">
                        <ButtonText>{t('calls.select_location')}</ButtonText>
                      </Button>
                    )}
                  </FormControl>
                ) : null}

                {showDestinationPoi ? (
                  <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.DestinationPoi)}>
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
                ) : null}
              </Card>
            ) : null}

            {showContactName ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.ContactName)}>
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
            ) : null}

            {showContactInfo ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.ContactInfo)}>
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
            ) : null}

            {/* The call's identifiers. A blank input keeps what the call already has. */}
            {showExternalId || showIncidentId || showReferenceId ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                {showExternalId ? renderIdentifierField('externalId', NewCallFieldKeys.ExternalId, t('call_detail.external_id'), 'external-id-input') : null}
                {showIncidentId ? renderIdentifierField('incidentId', NewCallFieldKeys.IncidentId, t('calls.incident_id'), 'incident-id-input') : null}
                {showReferenceId ? renderIdentifierField('referenceId', NewCallFieldKeys.ReferenceId, t('call_detail.reference_id'), 'reference-id-input') : null}
              </Card>
            ) : null}

            {/* Protocols: added to the ones already on the call, which an edit cannot remove. */}
            {showProtocols ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <View className="mb-4 flex-row items-center">
                  <BookOpenIcon size={16} color={colorScheme === 'dark' ? '#e5e7eb' : '#374151'} />
                  <Text className="ml-2 text-lg font-semibold">
                    {t('calls.protocols.title', 'Protocols')}
                    {requiredMark(NewCallFieldKeys.Protocols)}
                  </Text>
                </View>
                {attachedProtocols.length > 0 ? (
                  <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">{t('calls.protocols.attached', { names: attachedProtocols.map((protocol) => protocol.Name).join(', ') })}</Text>
                ) : null}
                <Button variant="outline" className="w-full" onPress={() => setShowProtocolSelector(true)}>
                  <BookOpenIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#374151'} />
                  <ButtonText className="ml-2">{selectedProtocols.length > 0 ? `${selectedProtocols.length} ${t('calls.protocols.selected_count', 'selected')}` : t('calls.protocols.add')}</ButtonText>
                </Button>
              </Card>
            ) : null}

            {/* Linked Call: adds a link; links the call already has are kept. */}
            {showLinkedCall ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <View className="mb-2 flex-row items-center">
                  <LinkIcon size={16} color={colorScheme === 'dark' ? '#e5e7eb' : '#374151'} />
                  <Text className="ml-2 text-lg font-semibold">
                    {t('calls.linked_calls.title', 'Linked Call')}
                    {requiredMark(NewCallFieldKeys.LinkedCall)}
                  </Text>
                </View>
                <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">{t('calls.linked_calls.edit_hint')}</Text>
                {linkedCall ? (
                  <Box className="mb-3 rounded-md bg-gray-50 p-3 dark:bg-gray-700">
                    <Text className="text-sm font-medium">
                      #{linkedCall.number} — {linkedCall.name}
                    </Text>
                    <Button size="sm" variant="link" onPress={() => setLinkedCall(null)}>
                      <ButtonText className="text-red-500">{t('common.remove', 'Remove')}</ButtonText>
                    </Button>
                  </Box>
                ) : null}
                <Button variant="outline" className="w-full" onPress={() => setShowLinkedCallsModal(true)}>
                  <LinkIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#374151'} />
                  <ButtonText className="ml-2">{linkedCall ? t('calls.linked_calls.change', 'Change linked call') : t('calls.linked_calls.select', 'Link to existing call')}</ButtonText>
                </Button>
              </Card>
            ) : null}

            {/* Additional Fields (UDF) */}
            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
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

            {/* Scheduled dispatch: never required on an edit; blank keeps whatever schedule the call has. A scheduled call's time can be moved but not cleared (EditCall cannot remove a schedule, so clearing would only look like it worked). */}
            {fieldPolicy.isVisible(NewCallFieldKeys.DispatchOn) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <FormControl>
                  <FormControlLabel>
                    <FormControlLabelText>{t('calls.scheduled_on')}</FormControlLabelText>
                  </FormControlLabel>
                  <Controller
                    control={control}
                    name="dispatchOn"
                    render={({ field: { onChange, value } }) => (
                      <DateTimeField value={value || ''} onChange={onChange} label={t('calls.scheduled_on')} mode="datetime" clearable={!initialDispatchOn} testID="scheduled-on-input" />
                    )}
                  />
                  <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('calls.scheduled_on_edit_hint')}</Text>
                </FormControl>
              </Card>
            ) : null}

            {/* With the dispatch list hidden its recipients cannot change, so there is nobody to notify of removal either. */}
            {showDispatchList ? (
              <>
                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  <Text className="mb-4 text-lg font-semibold">
                    {t('calls.dispatch_to')}
                    {!isPendingCall ? requiredMark(NewCallFieldKeys.DispatchList) : null}
                  </Text>
                  <Button onPress={() => setShowDispatchModal(true)} className="w-full">
                    <ButtonText>{getDispatchSummary()}</ButtonText>
                  </Button>
                </Card>

                <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                  <View className="flex-row items-center justify-between">
                    <View className="mr-3 flex-1">
                      <Text className="text-base font-semibold">{t('calls.notify_cancelled_entities')}</Text>
                      <Text className="text-sm text-gray-500">{t('calls.notify_cancelled_entities_description')}</Text>
                    </View>
                    <Controller control={control} name="notifyCancelledEntities" render={({ field: { onChange, value } }) => <Switch size="md" value={!!value} onValueChange={onChange} />} />
                  </View>
                </Card>
              </>
            ) : null}

            <Box className="mb-6 flex-row space-x-4">
              <Button className="mr-10 flex-1" variant="outline" onPress={() => router.back()}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button className="ml-10 flex-1" variant="solid" action="primary" isDisabled={!fieldPolicy.isLoaded} onPress={handleSubmit(onSubmit)}>
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

      {/* Protocol Selector modal */}
      <ProtocolSelectorModal isVisible={showProtocolSelector} onClose={() => setShowProtocolSelector(false)} onConfirm={setSelectedProtocols} initialSelected={selectedProtocols} />

      {/* Linked Calls modal */}
      <LinkedCallsModal isVisible={showLinkedCallsModal} onClose={() => setShowLinkedCallsModal(false)} onSelect={handleLinkedCallSelect} selectedCallId={linkedCall?.callId} excludeCallId={callId} />

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
