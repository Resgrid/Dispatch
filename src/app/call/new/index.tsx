import { zodResolver } from '@hookform/resolvers/zod';
import * as Location from 'expo-location';
import { type Href, router, Stack } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as z from 'zod';

import { createCall } from '@/api/calls/calls';
import { getNewCallData } from '@/api/dispatch/dispatch';
import { forwardGeocode, plusCodeLookup, reverseGeocode, what3WordsLookup } from '@/api/geocoding/geocoding';
import { saveUdfValues } from '@/api/userDefinedFields/userDefinedFields';
import { CallTemplatesModal, type TemplateSelection } from '@/components/calls/call-templates-modal';
import { ContactPickerModal } from '@/components/calls/contact-picker-modal';
import { DispatchSelectionModal } from '@/components/calls/dispatch-selection-modal';
import { LinkedCallsModal } from '@/components/calls/linked-calls-modal';
import { ProtocolSelectorModal, type SelectedProtocol } from '@/components/calls/protocol-selector-modal';
import { UdfFieldsRenderer } from '@/components/calls/udf-fields-renderer';
import { DateTimeField } from '@/components/common/date-time-field';
import { Loading } from '@/components/common/loading';
import FullScreenLocationPicker from '@/components/maps/full-screen-location-picker';
import LocationPicker from '@/components/maps/location-picker';
import { RecommendationPanel } from '@/components/runcards/recommendation-panel';
import { useCallRecommendation } from '@/components/runcards/use-call-recommendation';
import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { FormControl, FormControlError, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Input, InputField } from '@/components/ui/input';
import { BookOpenIcon, ChevronDownIcon, ChevronUpIcon, FileTextIcon, LinkIcon, PlusIcon, SearchIcon, UserIcon } from '@/components/ui/lucide-icons';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/use-analytics';
import { useNewCallFieldPolicy } from '@/hooks/use-new-call-field-policy';
import { useToast } from '@/hooks/use-toast';
import { describeCallFields, getMissingCallFieldsFromError, hasDispatchRecipients, toProtocolIds } from '@/lib/call-field-policy';
import { formatGeolocation } from '@/lib/call-geolocation';
import { isDispatchTimeTooSoon, toDispatchOnUtc } from '@/lib/call-schedule';
import { getPoiDestinationOptionLabel } from '@/lib/poi-display';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type NewCallFieldKey, NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';
import { type ContactResultData } from '@/models/v4/contacts/contactResultData';
import { type PoiResultData } from '@/models/v4/mapping/poiResultData';
import { type UdfFieldValueInput } from '@/models/v4/userDefinedFields/udfFieldValueInput';
import { useCoreStore } from '@/stores/app/core-store';
import { useCallsStore } from '@/stores/calls/store';
import { type DispatchSelection } from '@/stores/dispatch/store';

// Define the form schema using zod
const formSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  nature: z.string().min(1, { message: 'Nature is required' }),
  note: z.string().optional(),
  destinationPoiId: z.string().optional(),
  address: z.string().optional(),
  coordinates: z.string().optional(),
  what3words: z.string().optional(),
  plusCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  priority: z.string().min(1, { message: 'Priority is required' }),
  type: z.string().min(1, { message: 'Type is required' }),
  contactName: z.string().optional(),
  contactInfo: z.string().optional(),
  externalId: z.string().optional(),
  incidentId: z.string().optional(),
  referenceId: z.string().optional(),
  // When to dispatch, as the picker's ISO UTC instant; blank dispatches now.
  dispatchOn: z.string().optional(),
  dispatchSelection: z
    .object({
      everyone: z.boolean(),
      users: z.array(z.string()),
      groups: z.array(z.string()),
      roles: z.array(z.string()),
      units: z.array(z.string()),
    })
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

const NO_DESTINATION_VALUE = '__none__';

// Google Maps Geocoding API response types
interface GeocodingResult {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  place_id: string;
}

interface GeocodingResponse {
  results: GeocodingResult[];
  status: string;
}

// what3words API response types
interface What3WordsResponse {
  country: string;
  square: {
    southwest: {
      lng: number;
      lat: number;
    };
    northeast: {
      lng: number;
      lat: number;
    };
  };
  nearestPlace: string;
  coordinates: {
    lng: number;
    lat: number;
  };
  words: string;
  language: string;
  map: string;
}

export default function NewCall() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { callPriorities, callTypes, isLoadingPriorities, isLoadingTypes, prioritiesError, typesError, fetchCallPriorities, fetchCallTypes } = useCallsStore();
  // Only the first load of priorities and types holds the form back. The store's shared isLoading/error also follow
  // the active-calls list, which reloads on every call event, so gating on them blanked the form while it was in use.
  const isLoading = (isLoadingPriorities && callPriorities.length === 0) || (isLoadingTypes && callTypes.length === 0);
  const error = callPriorities.length === 0 ? prioritiesError : callTypes.length === 0 ? typesError : null;
  const { config } = useCoreStore();
  const { trackEvent } = useAnalytics();
  const toast = useToast();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showAddressSelection, setShowAddressSelection] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showProtocolSelector, setShowProtocolSelector] = useState(false);
  const [showLinkedCallsModal, setShowLinkedCallsModal] = useState(false);
  const [destinationPois, setDestinationPois] = useState<PoiResultData[]>([]);
  const [isLoadingDestinationPois, setIsLoadingDestinationPois] = useState(false);
  const [udfValues, setUdfValues] = useState<UdfFieldValueInput[]>([]);
  const [selectedProtocols, setSelectedProtocols] = useState<SelectedProtocol[]>([]);
  const [linkedCall, setLinkedCall] = useState<{ callId: string; number: string; name: string } | null>(null);
  // Contact picked from the picker; linked to the call as its primary contact (Contacts plan Phase A).
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  // Save as Pending: the call is stored and numbered but nobody is notified until a dispatcher sends it.
  const [isPending, setIsPending] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState({
    templates: false,
    callName: true,
    nature: true,
    priorityType: true,
    note: false,
    location: true,
    contact: false,
    protocols: false,
    linkedCall: false,
    additionalFields: false,
    dispatch: true,
  });

  const toggleSection = (section: keyof typeof sectionsExpanded) => {
    setSectionsExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isGeocodingPlusCode, setIsGeocodingPlusCode] = useState(false);
  const [isGeocodingCoordinates, setIsGeocodingCoordinates] = useState(false);
  const [isGeocodingWhat3Words, setIsGeocodingWhat3Words] = useState(false);
  const [addressResults, setAddressResults] = useState<GeocodingResult[]>([]);
  const [dispatchSelection, setDispatchSelection] = useState<DispatchSelection>({
    everyone: false,
    users: [],
    groups: [],
    roles: [],
    units: [],
  });

  // The department's new-call field policy: hides fields it does not use and blocks submission
  // until the ones it marked required have values. Unconfigured departments see the stock form.
  const fieldPolicy = useNewCallFieldPolicy();
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
    },
  });

  useEffect(() => {
    fetchCallPriorities();
    fetchCallTypes();
  }, [fetchCallPriorities, fetchCallTypes]);

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

  // Track when new call view is rendered
  useEffect(() => {
    trackEvent('new_call_view_rendered', {
      prioritiesCount: callPriorities.length,
      typesCount: callTypes.length,
    });
  }, [trackEvent, callPriorities.length, callTypes.length]);

  const onSubmit = async (data: FormValues) => {
    try {
      // The policy arrives asynchronously and reads as "nothing required" until it lands, so a
      // submit in that window would skip every field the department marked required. Hold the call
      // back instead. Fail-open only applies once the lookup has finished one way or the other.
      if (!fieldPolicy.isLoaded) {
        toast.error(t('calls.field_policy_loading'));
        return;
      }

      // The same value createCall sends, so "required" here and on the server agree on what counts
      // as a location (a single zero coordinate does; a blank pair or 0,0 does not).
      const geolocation = formatGeolocation(data.latitude, data.longitude);

      // The department may require fields beyond the built-in mandatory four. Enforced here for a
      // clear message, and again on the server so an old build cannot slip an incomplete call past.
      // Indoor location has no picker here, and the server does not enforce it on a save that sends no
      // zone, so neither does this.
      // A pending call is not dispatched or scheduled yet, so neither the dispatch list nor the dispatch
      // time can be required of it (the server skips both rules for pending calls too).
      const missingFields = fieldPolicy
        .missingRequired({
          [NewCallFieldKeys.Address]: data.address,
          [NewCallFieldKeys.Geolocation]: geolocation,
          [NewCallFieldKeys.What3Words]: data.what3words,
          [NewCallFieldKeys.PlusCode]: data.plusCode,
          [NewCallFieldKeys.Note]: data.note,
          [NewCallFieldKeys.ContactName]: data.contactName,
          [NewCallFieldKeys.ContactInfo]: data.contactInfo,
          [NewCallFieldKeys.ExternalId]: data.externalId,
          [NewCallFieldKeys.IncidentId]: data.incidentId,
          [NewCallFieldKeys.ReferenceId]: data.referenceId,
          [NewCallFieldKeys.DestinationPoi]: data.destinationPoiId,
          // What is actually sent: a picked protocol without a usable id cannot be attached.
          [NewCallFieldKeys.Protocols]: toProtocolIds(selectedProtocols).length > 0,
          [NewCallFieldKeys.LinkedCall]: !!linkedCall,
          [NewCallFieldKeys.DispatchOn]: data.dispatchOn,
          [NewCallFieldKeys.DispatchList]: hasDispatchRecipients(dispatchSelection),
        })
        .filter((key) => key !== NewCallFieldKeys.IndoorLocation && !(isPending && (key === NewCallFieldKeys.DispatchOn || key === NewCallFieldKeys.DispatchList)));

      if (missingFields.length > 0) {
        toast.error(t('calls.required_fields_missing', { fields: describeCallFields(missingFields, t) }));
        return;
      }

      // A scheduled dispatch has to be far enough ahead to be worth scheduling (a pending call ignores it).
      if (!isPending && isDispatchTimeTooSoon(data.dispatchOn)) {
        toast.error(t('calls.scheduled_on_too_soon'));
        return;
      }

      // If we have latitude and longitude, add them to the data
      if (selectedLocation?.latitude && selectedLocation?.longitude) {
        data.latitude = selectedLocation.latitude;
        data.longitude = selectedLocation.longitude;
      }

      // Validate priority and type before proceeding
      const priority = callPriorities.find((p) => p.Name === data.priority);
      const type = callTypes.find((t) => t.Name === data.type);

      if (!priority) {
        toast.error(t('calls.invalid_priority'));
        return;
      }

      if (!type) {
        toast.error(t('calls.invalid_type'));
        return;
      }

      console.log('Creating new call with data:', data);

      const response = await createCall({
        name: data.name,
        nature: data.nature,
        priority: priority.Id,
        type: type.Name,
        note: data.note,
        destinationPoiId: data.destinationPoiId ? Number(data.destinationPoiId) : null,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        what3words: data.what3words,
        plusCode: data.plusCode,
        dispatchUsers: data.dispatchSelection?.users,
        dispatchGroups: data.dispatchSelection?.groups,
        dispatchRoles: data.dispatchSelection?.roles,
        dispatchUnits: data.dispatchSelection?.units,
        dispatchEveryone: data.dispatchSelection?.everyone,
        // Sent whenever the picker is on screen, blank included, so the server links the call and
        // enforces the department's requirement; left out when the policy hides the picker.
        linkedCallId: fieldPolicy.isVisible(NewCallFieldKeys.LinkedCall) ? (linkedCall?.callId ?? '') : undefined,
        protocolIds: fieldPolicy.isVisible(NewCallFieldKeys.Protocols) ? toProtocolIds(selectedProtocols) : undefined,
        contactName: data.contactName,
        contactInfo: data.contactInfo,
        contactId: selectedContactId ?? undefined,
        externalId: data.externalId,
        incidentId: data.incidentId,
        referenceId: data.referenceId,
        dispatchOnUtc: isPending ? undefined : toDispatchOnUtc(data.dispatchOn),
        isPending,
      });

      if (udfValues.length > 0 && response?.Id) {
        try {
          await saveUdfValues(0, response.Id, udfValues);
        } catch (udfError) {
          console.warn('Failed to save UDF values:', udfError);
        }
      }

      if (isPending) {
        // Saved for later: show the queue it now waits in.
        toast.success(t('calls.pending_saved'));
        router.push('/pending-calls' as Href);
      } else {
        // Show success toast
        toast.success(t('calls.create_success'));

        // Navigate back to home dashboard
        router.push('/(app)/home' as Href);
      }
    } catch (error) {
      console.error('Error creating call:', error);

      // The server refuses a call the department's policy says is incomplete and names the fields;
      // say which, in the form's own words, rather than a bare "error creating call".
      const missingOnServer = getMissingCallFieldsFromError(error);

      toast.error(missingOnServer ? t('calls.required_fields_missing', { fields: describeCallFields(missingOnServer, t) }) : t('calls.create_error'));
    }
  };

  // Handle location selection from the full-screen picker
  const handleLocationSelected = (location: { latitude: number; longitude: number; address?: string }) => {
    setSelectedLocation(location);
    setShowLocationPicker(false);

    // Update form values
    setValue('latitude', location.latitude);
    setValue('longitude', location.longitude);

    if (location.address) {
      setValue('address', location.address);
    }

    // Format coordinates as string
    setValue('coordinates', `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
  };

  // Handle dispatch selection
  const handleDispatchSelection = (selection: DispatchSelection) => {
    setDispatchSelection(selection);
    setValue('dispatchSelection', selection);
  };

  // Run card recommendation. Inert unless the department has Dispatch.RunCards enabled.
  const runCardRecommendation = useCallRecommendation({
    priorityName: watch('priority'),
    typeName: watch('type'),
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    callPriorities,
  });

  const handleApplyRecommendation = () => {
    handleDispatchSelection(runCardRecommendation.applyToSelection(dispatchSelection));
  };

  // Get dispatch selection summary
  const getDispatchSummary = () => {
    if (dispatchSelection.everyone) {
      return t('calls.everyone');
    }

    const count = dispatchSelection.users.length + dispatchSelection.groups.length + dispatchSelection.roles.length + dispatchSelection.units.length;

    if (count === 0) {
      return t('calls.select_recipients');
    }

    return `${count} ${t('calls.selected')}`;
  };

  const handleTemplateSelect = (template: TemplateSelection) => {
    if (template.name) setValue('name', template.name);
    if (template.nature) setValue('nature', template.nature);
    if (template.type) setValue('type', template.type);
    if (template.priority) {
      const matched = callPriorities.find((p) => p.Id === template.priority);
      if (matched) setValue('priority', matched.Name);
    }
    toast.success(t('calls.templates.template_applied', 'Template applied'));
  };

  const handleContactSelect = (contact: ContactResultData) => {
    const parts = [contact.FirstName, contact.MiddleName, contact.LastName].filter(Boolean);
    const name = contact.CompanyName || parts.join(' ') || contact.Name || '';
    const info = contact.Email || String(contact.Phone || contact.Mobile || '');
    setValue('contactName', name);
    setValue('contactInfo', info);
    setSelectedContactId(contact.ContactId);
  };

  const handleLinkedCallSelect = (call: CallResultData) => {
    setLinkedCall({ callId: call.CallId, number: call.Number, name: call.Name });
  };

  /**
   * Handles address search using Google Maps Geocoding API
   *
   * Features:
   * - Validates empty/null address input and shows error toast
   * - Uses Google Maps API key from CoreStore configuration
   * - Handles single result: automatically selects location
   * - Handles multiple results: shows bottom sheet for user selection
   * - Handles API errors gracefully with user-friendly messages
   * - URL encodes addresses properly for special characters
   * - Shows loading state during API call
   *
   * @param address - The address string to geocode
   */
  const handleAddressSearch = async (address: string) => {
    if (!address.trim()) {
      toast.warning(t('calls.address_required'));
      return;
    }

    setIsGeocodingAddress(true);
    try {
      // Proxied through the Resgrid API — see src/api/geocoding/geocoding.ts for why.
      const lookup = await forwardGeocode(address);

      if (lookup.candidates.length > 0) {
        const results = lookup.candidates;

        if (results.length === 1) {
          // Single result - use it directly
          const result = results[0];
          const newLocation = {
            latitude: result.geometry.location.lat,
            longitude: result.geometry.location.lng,
            address: result.formatted_address,
          };

          // Update the selected location and form values
          handleLocationSelected(newLocation);

          // Show success toast
          toast.success(t('calls.address_found'));
        } else {
          // Multiple results - show selection bottom sheet
          setAddressResults(results);
          setShowAddressSelection(true);
        }
      } else {
        // The lookup running and matching nothing is a different problem to the lookup failing.
        toast.error(t(lookup.succeeded ? 'calls.address_not_found' : 'calls.geocoding_error'));
      }
    } catch (error) {
      console.error('Error geocoding address:', error);

      // Show error toast
      toast.error(t('calls.geocoding_error'));
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  // Handle address selection from bottom sheet
  const handleAddressSelected = (result: GeocodingResult) => {
    const newLocation = {
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
      address: result.formatted_address,
    };

    // Update the selected location and form values
    handleLocationSelected(newLocation);
    setShowAddressSelection(false);

    // Show success toast
    toast.success(t('calls.address_found'));
  };

  /**
   * Handles what3words search using what3words API
   *
   * Features:
   * - Validates empty/null what3words input and shows error toast
   * - Uses what3words API key from CoreStore configuration
   * - Handles API errors gracefully with user-friendly messages
   * - Shows loading state during API call
   * - Updates coordinates and address fields in form
   * - Validates what3words format (3 words separated by dots)
   *
   * @param what3words - The what3words string to geocode (e.g., "filled.count.soap")
   */
  const handleWhat3WordsSearch = async (what3words: string) => {
    if (!what3words.trim()) {
      toast.warning(t('calls.what3words_required'));
      return;
    }

    // Validate what3words format - should be 3 words separated by dots
    const w3wRegex = /^[a-z]+\.[a-z]+\.[a-z]+$/;
    if (!w3wRegex.test(what3words.trim().toLowerCase())) {
      toast.warning(t('calls.what3words_invalid_format'));
      return;
    }

    setIsGeocodingWhat3Words(true);
    try {
      // Proxied through the Resgrid API — see src/api/geocoding/geocoding.ts for why.
      const lookup = await what3WordsLookup(what3words);

      if (lookup.candidates.length > 0) {
        const result = lookup.candidates[0];
        const newLocation = {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          address: result.formatted_address,
        };

        // Update the selected location and form values
        handleLocationSelected(newLocation);

        // Show success toast
        toast.success(t('calls.what3words_found'));
      } else {
        toast.error(t(lookup.succeeded ? 'calls.what3words_not_found' : 'calls.what3words_geocoding_error'));
      }
    } catch (error) {
      console.error('Error geocoding what3words:', error);

      // Show error toast
      toast.error(t('calls.what3words_geocoding_error'));
    } finally {
      setIsGeocodingWhat3Words(false);
    }
  };

  /**
   * Handles plus code search using Google Maps Geocoding API
   *
   * Features:
   * - Validates empty/null plus code input and shows error toast
   * - Uses Google Maps API key from CoreStore configuration
   * - Handles API errors gracefully with user-friendly messages
   * - URL encodes plus codes properly for special characters
   * - Shows loading state during API call
   * - Updates coordinates and address fields in form
   *
   * @param plusCode - The plus code string to geocode
   */
  const handlePlusCodeSearch = async (plusCode: string) => {
    if (!plusCode.trim()) {
      toast.warning(t('calls.plus_code_required'));
      return;
    }

    setIsGeocodingPlusCode(true);
    try {
      // Proxied through the Resgrid API — see src/api/geocoding/geocoding.ts for why.
      const lookup = await plusCodeLookup(plusCode);

      if (lookup.candidates.length > 0) {
        const result = lookup.candidates[0];
        const newLocation = {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          address: result.formatted_address,
        };

        // Update the selected location and form values
        handleLocationSelected(newLocation);

        // Show success toast
        toast.success(t('calls.plus_code_found'));
      } else {
        toast.error(t(lookup.succeeded ? 'calls.plus_code_not_found' : 'calls.plus_code_geocoding_error'));
      }
    } catch (error) {
      console.error('Error geocoding plus code:', error);

      // Show error toast
      toast.error(t('calls.plus_code_geocoding_error'));
    } finally {
      setIsGeocodingPlusCode(false);
    }
  };

  /**
   * Handles coordinates search using Google Maps Reverse Geocoding API
   *
   * Features:
   * - Validates and parses coordinates string (lat,lng format)
   * - Uses Google Maps API key from CoreStore configuration
   * - Handles API errors gracefully with user-friendly messages
   * - Shows loading state during API call
   * - Updates address field and map location
   * - Supports various coordinate formats (decimal degrees)
   *
   * @param coordinates - The coordinates string to reverse geocode (e.g., "40.7128, -74.0060")
   */
  const handleCoordinatesSearch = async (coordinates: string) => {
    if (!coordinates.trim()) {
      toast.warning(t('calls.coordinates_required'));
      return;
    }

    // Parse coordinates - expect format like "40.7128, -74.0060" or "40.7128,-74.0060"
    const coordRegex = /^(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)$/;
    const match = coordinates.trim().match(coordRegex);

    if (!match) {
      toast.warning(t('calls.coordinates_invalid_format'));
      return;
    }

    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      toast.warning(t('calls.coordinates_out_of_range'));
      return;
    }

    setIsGeocodingCoordinates(true);
    try {
      // Proxied through the Resgrid API — see src/api/geocoding/geocoding.ts for why.
      const lookup = await reverseGeocode(latitude, longitude);

      if (lookup.address) {
        const newLocation = {
          latitude,
          longitude,
          address: lookup.address,
        };

        // Update the selected location and form values
        handleLocationSelected(newLocation);

        // Show success toast
        toast.success(t('calls.coordinates_found'));
      } else {
        // Even if no address found, still set the location on the map
        const newLocation = {
          latitude,
          longitude,
          address: undefined,
        };

        handleLocationSelected(newLocation);

        // Show info toast
        toast.info(t('calls.coordinates_no_address'));
      }
    } catch (error) {
      console.error('Error reverse geocoding coordinates:', error);

      // Even if geocoding fails, still set the location on the map
      const newLocation = {
        latitude,
        longitude,
        address: undefined,
      };

      handleLocationSelected(newLocation);

      // Show warning toast
      toast.warning(t('calls.coordinates_geocoding_error'));
    } finally {
      setIsGeocodingCoordinates(false);
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <View className="size-full flex-1">
        <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5 lg:min-w-[700px]">
          <Text className="error text-center">{error}</Text>
        </Box>
      </View>
    );
  }

  // Every rule the department can set drives its own control. The location card groups five of
  // them, so it only disappears once the policy has hidden all five.
  const showAddress = fieldPolicy.isVisible(NewCallFieldKeys.Address);
  const showGeolocation = fieldPolicy.isVisible(NewCallFieldKeys.Geolocation);
  const showWhat3Words = fieldPolicy.isVisible(NewCallFieldKeys.What3Words);
  const showPlusCode = fieldPolicy.isVisible(NewCallFieldKeys.PlusCode);
  const showDestinationPoi = fieldPolicy.isVisible(NewCallFieldKeys.DestinationPoi);
  const showLocationCard = showAddress || showGeolocation || showWhat3Words || showPlusCode || showDestinationPoi;
  // Fields the department requires are marked the way the built-in ones are; labelled inputs get the
  // form control's own asterisk, section titles get this one.
  const requiredMark = (key: NewCallFieldKey) => (fieldPolicy.isRequired(key) ? <Text className="text-red-500"> *</Text> : null);
  const showContactName = fieldPolicy.isVisible(NewCallFieldKeys.ContactName);
  const showContactInfo = fieldPolicy.isVisible(NewCallFieldKeys.ContactInfo);
  const showExternalId = fieldPolicy.isVisible(NewCallFieldKeys.ExternalId);
  const showIncidentId = fieldPolicy.isVisible(NewCallFieldKeys.IncidentId);
  const showReferenceId = fieldPolicy.isVisible(NewCallFieldKeys.ReferenceId);

  // The call's own identifiers: plain text inputs, each gated and marked by the policy.
  const renderIdentifierField = (name: 'externalId' | 'incidentId' | 'referenceId', key: NewCallFieldKey, label: string, testID: string) => (
    <FormControl className="mt-3" isRequired={fieldPolicy.isRequired(key)}>
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
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          title: t('calls.new_call'),
          headerShown: true,
          headerBackTitle: '',
        }}
      />
      <View className="size-full flex-1">
        <Box className="size-full w-full flex-1 bg-gray-50 dark:bg-gray-900">
          <ScrollView className="flex-1 px-4 py-6" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }} style={{ paddingTop: Math.max(insets.top, 16) }}>
            <Text className="mb-6 text-2xl font-bold">{t('calls.create_new_call')}</Text>

            {/* Call Templates */}
            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
              <TouchableOpacity onPress={() => toggleSection('templates')} className="flex-row items-center justify-between p-4">
                <View className="flex-row items-center">
                  <FileTextIcon size={16} color={colorScheme === 'dark' ? '#e5e7eb' : '#374151'} />
                  <Text className="ml-2 text-base font-semibold">{t('calls.templates.title', 'Call Templates')}</Text>
                </View>
                {sectionsExpanded.templates ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
              </TouchableOpacity>
              {sectionsExpanded.templates ? (
                <View className="px-4 pb-4">
                  <Button variant="outline" onPress={() => setShowTemplatesModal(true)} className="w-full">
                    <FileTextIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#374151'} />
                    <ButtonText className="ml-2">{t('calls.templates.select_template', 'Select Template')}</ButtonText>
                  </Button>
                </View>
              ) : null}
            </Card>

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
              <TouchableOpacity onPress={() => toggleSection('callName')} className="flex-row items-center justify-between p-4">
                <Text className="text-base font-semibold">{t('calls.name')}</Text>
                {sectionsExpanded.callName ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
              </TouchableOpacity>
              {sectionsExpanded.callName ? (
                <View className="px-4 pb-4">
                  <FormControl isInvalid={!!errors.name}>
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
                </View>
              ) : null}
            </Card>

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
              <TouchableOpacity onPress={() => toggleSection('nature')} className="flex-row items-center justify-between p-4">
                <Text className="text-base font-semibold">{t('calls.nature')}</Text>
                {sectionsExpanded.nature ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
              </TouchableOpacity>
              {sectionsExpanded.nature ? (
                <View className="px-4 pb-4">
                  <FormControl isInvalid={!!errors.nature}>
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
                </View>
              ) : null}
            </Card>

            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
              <TouchableOpacity onPress={() => toggleSection('priorityType')} className="flex-row items-center justify-between p-4">
                <Text className="text-base font-semibold">{t('calls.priority_and_type', 'Priority & Type')}</Text>
                {sectionsExpanded.priorityType ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
              </TouchableOpacity>
              {sectionsExpanded.priorityType ? (
                <View className="px-4 pb-4">
                  <FormControl isInvalid={!!errors.priority} className="mb-4">
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.priority')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="priority"
                      render={({ field: { onChange, value } }) => (
                        <Select onValueChange={onChange} selectedValue={value}>
                          <SelectTrigger>
                            <SelectInput placeholder={t('calls.select_priority')} className="w-5/6" />
                            <SelectIcon as={ChevronDownIcon} className="mr-3" />
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
                  <FormControl isInvalid={!!errors.type}>
                    <FormControlLabel>
                      <FormControlLabelText>{t('calls.type')}</FormControlLabelText>
                    </FormControlLabel>
                    <Controller
                      control={control}
                      name="type"
                      render={({ field: { onChange, value } }) => (
                        <Select onValueChange={onChange} selectedValue={value}>
                          <SelectTrigger>
                            <SelectInput placeholder={t('calls.select_type')} className="w-5/6" />
                            <SelectIcon as={ChevronDownIcon} className="mr-3" />
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
                </View>
              ) : null}
            </Card>

            {fieldPolicy.isVisible(NewCallFieldKeys.Note) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <TouchableOpacity onPress={() => toggleSection('note')} className="flex-row items-center justify-between p-4">
                  <Text className="text-base font-semibold">
                    {t('calls.note')}
                    {requiredMark(NewCallFieldKeys.Note)}
                  </Text>
                  {sectionsExpanded.note ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
                </TouchableOpacity>
                {sectionsExpanded.note ? (
                  <View className="px-4 pb-4">
                    <FormControl>
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
                  </View>
                ) : null}
              </Card>
            ) : null}

            {showLocationCard ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <TouchableOpacity onPress={() => toggleSection('location')} className="flex-row items-center justify-between p-4">
                  <Text className="text-base font-semibold">{t('calls.call_location')}</Text>
                  {sectionsExpanded.location ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
                </TouchableOpacity>
                {sectionsExpanded.location ? (
                  <View className="px-4 pb-4">
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

                    {/* GPS Coordinates Field */}
                    {showGeolocation ? (
                      <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.Geolocation)}>
                        <FormControlLabel>
                          <FormControlLabelText>{t('calls.coordinates')}</FormControlLabelText>
                        </FormControlLabel>
                        <Controller
                          control={control}
                          name="coordinates"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <Box className="flex-row items-center space-x-2">
                              <Box className="flex-1">
                                <Input>
                                  <InputField testID="coordinates-input" placeholder={t('calls.coordinates_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                                </Input>
                              </Box>
                              <Button
                                testID="coordinates-search-button"
                                size="sm"
                                variant="outline"
                                className="ml-2"
                                onPress={() => handleCoordinatesSearch(value || '')}
                                disabled={isGeocodingCoordinates || !value?.trim()}
                              >
                                {isGeocodingCoordinates ? <Text>...</Text> : <SearchIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#000000'} />}
                              </Button>
                            </Box>
                          )}
                        />
                      </FormControl>
                    ) : null}

                    {/* what3words Field */}
                    {showWhat3Words ? (
                      <FormControl className="mb-4" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.What3Words)}>
                        <FormControlLabel>
                          <FormControlLabelText>{t('calls.what3words')}</FormControlLabelText>
                        </FormControlLabel>
                        <Controller
                          control={control}
                          name="what3words"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <Box className="flex-row items-center space-x-2">
                              <Box className="flex-1">
                                <Input>
                                  <InputField testID="what3words-input" placeholder={t('calls.what3words_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                                </Input>
                              </Box>
                              <Button testID="what3words-search-button" size="sm" variant="outline" className="ml-2" onPress={() => handleWhat3WordsSearch(value || '')} disabled={isGeocodingWhat3Words || !value?.trim()}>
                                {isGeocodingWhat3Words ? <Text>...</Text> : <SearchIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#000000'} />}
                              </Button>
                            </Box>
                          )}
                        />
                      </FormControl>
                    ) : null}

                    {/* Plus Code Field */}
                    {showPlusCode ? (
                      <FormControl className="mb-4">
                        <FormControlLabel>
                          <FormControlLabelText>{t('calls.plus_code')}</FormControlLabelText>
                        </FormControlLabel>
                        <Controller
                          control={control}
                          name="plusCode"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <Box className="flex-row items-center space-x-2">
                              <Box className="flex-1">
                                <Input>
                                  <InputField testID="plus-code-input" placeholder={t('calls.plus_code_placeholder')} value={value} onChangeText={onChange} onBlur={onBlur} />
                                </Input>
                              </Box>
                              <Button testID="plus-code-search-button" size="sm" variant="outline" className="ml-2" onPress={() => handlePlusCodeSearch(value || '')} disabled={isGeocodingPlusCode || !value?.trim()}>
                                {isGeocodingPlusCode ? <Text>...</Text> : <SearchIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#000000'} />}
                              </Button>
                            </Box>
                          )}
                        />
                      </FormControl>
                    ) : null}

                    {/* Map Preview — the map is how a dispatcher fills the geolocation in. */}
                    {showGeolocation ? (
                      <Box className="mb-4">
                        {selectedLocation ? (
                          <LocationPicker initialLocation={selectedLocation} onLocationSelected={handleLocationSelected} height={200} />
                        ) : (
                          <Button onPress={() => setShowLocationPicker(true)} className="w-full">
                            <ButtonText>{t('calls.select_location')}</ButtonText>
                          </Button>
                        )}
                      </Box>
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
                                <SelectInput placeholder={t('calls.select_destination_poi')} className="w-5/6" />
                                <SelectIcon as={ChevronDownIcon} className="mr-3" />
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
                  </View>
                ) : null}
              </Card>
            ) : null}

            {/* One card holds the contact fields and the call's identifiers (as on the web form), so it shows when any is enabled. */}
            {showContactName || showContactInfo || showExternalId || showIncidentId || showReferenceId ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <TouchableOpacity onPress={() => toggleSection('contact')} className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <UserIcon size={16} color={colorScheme === 'dark' ? '#e5e7eb' : '#374151'} />
                    <Text className="ml-2 text-base font-semibold">{t('calls.contact_information', 'Contact Information')}</Text>
                  </View>
                  {sectionsExpanded.contact ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
                </TouchableOpacity>
                {sectionsExpanded.contact ? (
                  <View className="px-4 pb-4">
                    {/* The picker fills the contact fields, so it only shows when one of them does. */}
                    {showContactName || showContactInfo ? (
                      <Button variant="outline" className="mb-3 w-full" onPress={() => setShowContactPicker(true)}>
                        <UserIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#374151'} />
                        <ButtonText className="ml-2">{t('calls.contact_picker.search_placeholder', 'Search contacts...')}</ButtonText>
                      </Button>
                    ) : null}
                    {/* The card shows when any field is enabled, so each one still guards itself. */}
                    {showContactName ? (
                      <FormControl className="mb-3" isRequired={fieldPolicy.isRequired(NewCallFieldKeys.ContactName)}>
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
                    ) : null}
                    {showContactInfo ? (
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
                    ) : null}
                    {showExternalId ? renderIdentifierField('externalId', NewCallFieldKeys.ExternalId, t('call_detail.external_id'), 'external-id-input') : null}
                    {showIncidentId ? renderIdentifierField('incidentId', NewCallFieldKeys.IncidentId, t('calls.incident_id'), 'incident-id-input') : null}
                    {showReferenceId ? renderIdentifierField('referenceId', NewCallFieldKeys.ReferenceId, t('call_detail.reference_id'), 'reference-id-input') : null}
                  </View>
                ) : null}
              </Card>
            ) : null}

            {/* Protocols */}
            {fieldPolicy.isVisible(NewCallFieldKeys.Protocols) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <TouchableOpacity onPress={() => toggleSection('protocols')} className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <BookOpenIcon size={16} color={colorScheme === 'dark' ? '#e5e7eb' : '#374151'} />
                    <Text className="ml-2 text-base font-semibold">
                      {t('calls.protocols.title', 'Protocols')}
                      {requiredMark(NewCallFieldKeys.Protocols)}
                    </Text>
                    {selectedProtocols.length > 0 ? (
                      <View className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 dark:bg-blue-800">
                        <Text className="text-xs font-medium text-blue-700 dark:text-blue-200">{selectedProtocols.length}</Text>
                      </View>
                    ) : null}
                  </View>
                  {sectionsExpanded.protocols ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
                </TouchableOpacity>
                {sectionsExpanded.protocols ? (
                  <View className="px-4 pb-4">
                    <Button variant="outline" className="w-full" onPress={() => setShowProtocolSelector(true)}>
                      <BookOpenIcon size={16} color={colorScheme === 'dark' ? '#ffffff' : '#374151'} />
                      <ButtonText className="ml-2">
                        {selectedProtocols.length > 0 ? `${selectedProtocols.length} ${t('calls.protocols.selected_count', 'selected')}` : t('calls.protocols.select', 'Select Protocols')}
                      </ButtonText>
                    </Button>
                  </View>
                ) : null}
              </Card>
            ) : null}

            {/* Linked Call */}
            {fieldPolicy.isVisible(NewCallFieldKeys.LinkedCall) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <TouchableOpacity onPress={() => toggleSection('linkedCall')} className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <LinkIcon size={16} color={colorScheme === 'dark' ? '#e5e7eb' : '#374151'} />
                    <Text className="ml-2 text-base font-semibold">
                      {t('calls.linked_calls.title', 'Linked Call')}
                      {requiredMark(NewCallFieldKeys.LinkedCall)}
                    </Text>
                    {linkedCall ? (
                      <View className="ml-2 rounded-full bg-green-100 px-2 py-0.5 dark:bg-green-800">
                        <Text className="text-xs font-medium text-green-700 dark:text-green-200">#{linkedCall.number}</Text>
                      </View>
                    ) : null}
                  </View>
                  {sectionsExpanded.linkedCall ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
                </TouchableOpacity>
                {sectionsExpanded.linkedCall ? (
                  <View className="px-4 pb-4">
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
                  </View>
                ) : null}
              </Card>
            ) : null}

            {/* Additional Fields (UDF) */}
            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
              <TouchableOpacity onPress={() => toggleSection('additionalFields')} className="flex-row items-center justify-between p-4">
                <Text className="text-base font-semibold">{t('calls.additional_fields', 'Additional Fields')}</Text>
                {sectionsExpanded.additionalFields ? (
                  <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
                ) : (
                  <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
                )}
              </TouchableOpacity>
              {sectionsExpanded.additionalFields ? (
                <View className="px-4 pb-4">
                  <UdfFieldsRenderer entityType={0} onValuesChange={setUdfValues} isDark={colorScheme === 'dark'} />
                </View>
              ) : null}
            </Card>

            {/* Save as Pending: always offered, whatever the field policy shows, because it is what lets a
                call be stored without dispatching it. */}
            <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
              <View className="flex-row items-center justify-between">
                <View className="mr-3 flex-1">
                  <Text className="text-base font-semibold">{t('calls.save_as_pending')}</Text>
                  <Text className="text-sm text-gray-500">{t('calls.save_as_pending_description')}</Text>
                </View>
                <Switch size="md" value={isPending} onValueChange={setIsPending} testID="save-as-pending-switch" aria-label={t('calls.save_as_pending')} />
              </View>
            </Card>

            {/* Schedule Dispatch (a pending call has no dispatch time, so it hides while "Save as pending" is on) */}
            {fieldPolicy.isVisible(NewCallFieldKeys.DispatchOn) && !isPending ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <Text className="text-base font-semibold">{t('calls.schedule_dispatch')}</Text>
                <Text className="mb-3 text-sm text-gray-500">{t('calls.schedule_dispatch_description')}</Text>
                <FormControl isRequired={fieldPolicy.isRequired(NewCallFieldKeys.DispatchOn)}>
                  <FormControlLabel>
                    <FormControlLabelText>{t('calls.scheduled_on')}</FormControlLabelText>
                  </FormControlLabel>
                  <Controller
                    control={control}
                    name="dispatchOn"
                    render={({ field: { onChange, value } }) => <DateTimeField value={value || ''} onChange={onChange} label={t('calls.scheduled_on')} mode="datetime" testID="scheduled-on-input" />}
                  />
                  <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('calls.scheduled_on_helper')}</Text>
                </FormControl>
              </Card>
            ) : null}

            {fieldPolicy.isVisible(NewCallFieldKeys.DispatchList) ? (
              <Card className="mb-4 rounded-xl bg-white p-4 shadow-xs dark:bg-gray-800">
                <TouchableOpacity onPress={() => toggleSection('dispatch')} className="flex-row items-center justify-between p-4">
                  <Text className="text-base font-semibold">
                    {t('calls.dispatch_to')}
                    {!isPending ? requiredMark(NewCallFieldKeys.DispatchList) : null}
                  </Text>
                  {sectionsExpanded.dispatch ? <ChevronUpIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={16} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />}
                </TouchableOpacity>
                {sectionsExpanded.dispatch ? (
                  <View className="px-4 pb-4">
                    {runCardRecommendation.isRunCardsEnabled ? (
                      <RecommendationPanel
                        recommendation={runCardRecommendation.recommendation}
                        isLoading={runCardRecommendation.isLoading}
                        error={runCardRecommendation.error}
                        hasFetched={runCardRecommendation.hasFetched}
                        isApplied={runCardRecommendation.isApplied}
                        onApply={handleApplyRecommendation}
                        onRefresh={runCardRecommendation.refresh}
                      />
                    ) : null}
                    <Button onPress={() => setShowDispatchModal(true)} className="w-full">
                      <ButtonText>{getDispatchSummary()}</ButtonText>
                    </Button>
                  </View>
                ) : null}
              </Card>
            ) : null}

            <Box className="mb-6 flex-row space-x-4" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
              <Button className="mr-10 flex-1" variant="outline" onPress={() => router.back()}>
                <ButtonText>{t('common.cancel')}</ButtonText>
              </Button>
              <Button className="ml-10 flex-1" variant="solid" action="primary" isDisabled={!fieldPolicy.isLoaded} onPress={handleSubmit(onSubmit)}>
                <PlusIcon size={18} className="mr-2" />
                <ButtonText>{isPending ? t('calls.save_pending_call') : t('calls.create')}</ButtonText>
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

      {/* Call Templates modal */}
      <CallTemplatesModal isVisible={showTemplatesModal} onClose={() => setShowTemplatesModal(false)} onSelect={handleTemplateSelect} />

      {/* Contact Picker modal */}
      <ContactPickerModal isVisible={showContactPicker} onClose={() => setShowContactPicker(false)} onSelect={handleContactSelect} />

      {/* Protocol Selector modal */}
      <ProtocolSelectorModal isVisible={showProtocolSelector} onClose={() => setShowProtocolSelector(false)} onConfirm={setSelectedProtocols} initialSelected={selectedProtocols} />

      {/* Linked Calls modal */}
      <LinkedCallsModal isVisible={showLinkedCallsModal} onClose={() => setShowLinkedCallsModal(false)} onSelect={handleLinkedCallSelect} selectedCallId={linkedCall?.callId} />

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
