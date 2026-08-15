import { zodResolver } from '@hookform/resolvers/zod';
import { type Href, router, Stack } from 'expo-router';
import { BookOpenIcon, CalendarClockIcon, ChevronDownIcon, ChevronUpIcon, FileTextIcon, LinkIcon, MapPinIcon, PlusIcon, SearchIcon, UserIcon, XIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import * as z from 'zod';

import { createCall } from '@/api/calls/calls';
import { getNewCallData } from '@/api/dispatch/dispatch';
import { getNewCallForm } from '@/api/forms/forms';
import { forwardGeocode, plusCodeLookup, reverseGeocode, what3WordsLookup } from '@/api/geocoding/geocoding';
import { saveUdfValues } from '@/api/userDefinedFields/userDefinedFields';
import { CallFormRenderer } from '@/components/calls/call-form-renderer';
import { CallTemplatesModal, type TemplateSelection } from '@/components/calls/call-templates-modal';
import { ContactPickerModal } from '@/components/calls/contact-picker-modal';
import { DispatchSelectionModal } from '@/components/calls/dispatch-selection-modal';
import { LinkedCallsModal } from '@/components/calls/linked-calls-modal';
import { ProtocolSelectorModal, type SelectedProtocol } from '@/components/calls/protocol-selector-modal';
import { UdfFieldsRenderer } from '@/components/calls/udf-fields-renderer';
import { Loading } from '@/components/common/loading';
import FullScreenLocationPicker from '@/components/maps/full-screen-location-picker';
import LocationPicker from '@/components/maps/location-picker';
import { RecommendationPanel } from '@/components/runcards/recommendation-panel';
import { useCallRecommendation } from '@/components/runcards/use-call-recommendation';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { useNewCallFieldPolicy } from '@/hooks/use-new-call-field-policy';
import { useToast } from '@/hooks/use-toast';
import { getPoiDestinationOptionLabel } from '@/lib/poi-display';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { type NewCallFieldKey, NewCallFieldKeys } from '@/models/v4/calls/newCallFieldPolicyResultData';

// The policy speaks in stable wire keys; a dispatcher told to fill in 'contactName' is being shown
// the protocol rather than their own form. Map each key back to the label this screen already puts
// on the field. Only the fields this screen renders appear here — anything else falls back to the
// raw key, which at least names something, rather than being dropped from the message.
const NEW_CALL_FIELD_LABEL_KEYS: Partial<Record<NewCallFieldKey, string>> = {
  [NewCallFieldKeys.Address]: 'calls.address',
  [NewCallFieldKeys.Geolocation]: 'calls.coordinates',
  [NewCallFieldKeys.What3Words]: 'calls.what3words',
  [NewCallFieldKeys.PlusCode]: 'calls.plus_code',
  [NewCallFieldKeys.Note]: 'calls.note',
  [NewCallFieldKeys.ContactName]: 'calls.contact_name',
  [NewCallFieldKeys.ContactInfo]: 'calls.contact_info',
  [NewCallFieldKeys.DestinationPoi]: 'calls.destination',
  [NewCallFieldKeys.DispatchOn]: 'calls.scheduled_on',
  [NewCallFieldKeys.DispatchList]: 'calls.dispatch_to',
};
import { type ContactResultData } from '@/models/v4/contacts/contactResultData';
import { type FormResultData } from '@/models/v4/forms/formResultData';
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
  scheduledOn: z.string().optional(),
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
    southwest: { lng: number; lat: number };
    northeast: { lng: number; lat: number };
  };
  nearestPlace: string;
  coordinates: { lng: number; lat: number };
  words: string;
  language: string;
  map: string;
}

// Web-optimized input component with keyboard support
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

  // Add accessible focus styles for keyboard navigation
  const accessibleInputStyles = {
    ...inputStyles,
    outline: 'none',
  } as React.CSSProperties & {
    '&:focus-visible'?: React.CSSProperties;
  };

  return (
    <View style={styles.webInputContainer}>
      <Text style={StyleSheet.flatten([styles.webLabel, isDark ? styles.webLabelDark : styles.webLabelLight])}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View style={styles.inputWrapper}>
        {multiline ? (
          <textarea
            className="web-input-accessible"
            style={accessibleInputStyles as React.CSSProperties}
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
            className="web-input-accessible"
            style={accessibleInputStyles as React.CSSProperties}
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

// Web-optimized datetime input component
interface WebDateTimeInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  error?: string;
  helperText?: string;
  testID?: string;
}

const WebDateTimeInput: React.FC<WebDateTimeInputProps> = ({ label, value, onChange, min, error, helperText, testID }) => {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const inputStyles = StyleSheet.flatten([webStyles.webInput as any, isDark ? styles.webInputDark : styles.webInputLight, error ? styles.webInputError : {}]);

  const accessibleInputStyles = {
    ...inputStyles,
    outline: 'none',
  } as React.CSSProperties;

  return (
    <View style={styles.webInputContainer}>
      <Text style={StyleSheet.flatten([styles.webLabel, isDark ? styles.webLabelDark : styles.webLabelLight])}>{label}</Text>
      <input type="datetime-local" className="web-input-accessible" style={accessibleInputStyles} value={value} onChange={(e) => onChange(e.target.value)} min={min} data-testid={testID} />
      {helperText ? <Text style={StyleSheet.flatten([styles.webLabel, { color: isDark ? '#9ca3af' : '#6b7280', fontWeight: '400', marginTop: 4 }])}>{helperText}</Text> : null}
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

  const selectStyles = StyleSheet.flatten([webStyles.webSelect as any, isDark ? styles.webSelectDark : styles.webSelectLight, error ? styles.webInputError : {}]);

  // Add accessible focus styles for keyboard navigation
  const accessibleSelectStyles = {
    ...selectStyles,
    outline: 'none',
  } as React.CSSProperties;

  return (
    <View style={styles.webInputContainer}>
      <Text style={StyleSheet.flatten([styles.webLabel, isDark ? styles.webLabelDark : styles.webLabelLight])}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <select className="web-input-accessible" style={accessibleSelectStyles} value={value} onChange={(e) => onChange(e.target.value)}>
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

export default function NewCallWeb() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  const { callPriorities, callTypes, isLoading, error, fetchCallPriorities, fetchCallTypes } = useCallsStore();
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
  const [callFormData, setCallFormData] = useState<string | null>(null);
  const [callForm, setCallForm] = useState<FormResultData | null>(null);
  const [destinationPois, setDestinationPois] = useState<PoiResultData[]>([]);
  const [isLoadingDestinationPois, setIsLoadingDestinationPois] = useState(false);
  const [udfValues, setUdfValues] = useState<UdfFieldValueInput[]>([]);
  const [selectedProtocols, setSelectedProtocols] = useState<SelectedProtocol[]>([]);
  const [linkedCall, setLinkedCall] = useState<{ callId: string; number: string; name: string } | null>(null);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sectionsExpanded, setSectionsExpanded] = useState({
    templates: false,
    callDetails: true,
    scheduledDispatch: false,
    contact: false,
    protocols: false,
    linkedCall: false,
    callForm: false,
    additionalFields: false,
    location: true,
    dispatch: true,
  });

  const toggleSection = (section: keyof typeof sectionsExpanded) => {
    setSectionsExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const nameInputRef = useRef<HTMLInputElement>(null);

  const isDark = colorScheme === 'dark';
  const isWideScreen = width >= 1024;

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
      scheduledOn: '',
      dispatchSelection: {
        everyone: false,
        users: [],
        groups: [],
        roles: [],
        units: [],
      },
    },
  });

  const watchedPriority = watch('priority');
  const watchedType = watch('type');
  const watchedAddress = watch('address');
  const watchedCoordinates = watch('coordinates');
  const watchedWhat3Words = watch('what3words');
  const watchedPlusCode = watch('plusCode');

  useEffect(() => {
    fetchCallPriorities();
    fetchCallTypes();
  }, [fetchCallPriorities, fetchCallTypes]);

  useEffect(() => {
    getNewCallForm()
      .then((result) => {
        if (result?.Data?.Data) setCallForm(result.Data);
      })
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    trackEvent('new_call_web_view_rendered', {
      prioritiesCount: callPriorities.length,
      typesCount: callTypes.length,
    });
  }, [trackEvent, callPriorities.length, callTypes.length]);

  const onSubmit = useCallback(
    async (data: FormValues) => {
      try {
        setIsSubmitting(true);

        // The policy arrives asynchronously and reads as "nothing required" until it lands, so a
        // submit in that window would skip every field the department marked required. Hold the call
        // back instead. Fail-open only applies once the lookup has finished one way or the other.
        if (!fieldPolicy.isLoaded) {
          setIsSubmitting(false);
          toast.error(t('calls.field_policy_loading'));
          return;
        }

        // A location on the equator or the prime meridian has a zero coordinate, which is a real
        // place, not a blank field — test that both are finite rather than truthy.
        const hasGeolocation = Number.isFinite(data.latitude) && Number.isFinite(data.longitude);

        // The department may require fields beyond the built-in mandatory four. Enforced here for a
        // clear message, and again on the server so an old build cannot slip an incomplete call past.
        // DispatchOn belongs here, unlike on the other forms: this screen is the one that actually
        // renders a scheduling input and sends ScheduledOn.
        const missingFields = fieldPolicy.missingRequired({
          [NewCallFieldKeys.Address]: data.address,
          [NewCallFieldKeys.Geolocation]: hasGeolocation ? `${data.latitude},${data.longitude}` : '',
          [NewCallFieldKeys.What3Words]: data.what3words,
          [NewCallFieldKeys.PlusCode]: data.plusCode,
          [NewCallFieldKeys.Note]: data.note,
          [NewCallFieldKeys.ContactName]: data.contactName,
          [NewCallFieldKeys.ContactInfo]: data.contactInfo,
          [NewCallFieldKeys.DestinationPoi]: data.destinationPoiId,
          [NewCallFieldKeys.DispatchOn]: data.scheduledOn,
          [NewCallFieldKeys.DispatchList]:
            dispatchSelection.everyone || dispatchSelection.units.length > 0 || dispatchSelection.users.length > 0 || dispatchSelection.groups.length > 0 || dispatchSelection.roles.length > 0,
        });

        if (missingFields.length > 0) {
          setIsSubmitting(false);

          const missingLabels = missingFields.map((key) => {
            const labelKey = NEW_CALL_FIELD_LABEL_KEYS[key];

            return labelKey ? t(labelKey) : key;
          });

          toast.error(t('calls.required_fields_missing', { fields: missingLabels.join(', ') }));
          return;
        }

        if (selectedLocation?.latitude && selectedLocation?.longitude) {
          data.latitude = selectedLocation.latitude;
          data.longitude = selectedLocation.longitude;
        }

        // Validate scheduled time is in the future if provided
        if (data.scheduledOn?.trim()) {
          const scheduledDate = new Date(data.scheduledOn);
          if (scheduledDate <= new Date()) {
            setIsSubmitting(false);
            toast.error(t('calls.scheduled_on_past_error'));
            return;
          }
        }

        const priority = callPriorities.find((p) => p.Name === data.priority);
        const type = callTypes.find((t) => t.Name === data.type);

        if (!priority) {
          setIsSubmitting(false);
          toast.error(t('calls.invalid_priority'));
          return;
        }

        if (!type) {
          setIsSubmitting(false);
          toast.error(t('calls.invalid_type'));
          return;
        }

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
          callFormData: callFormData ?? undefined,
          linkedCallId: linkedCall?.callId,
          scheduledOn: data.scheduledOn?.trim() ? new Date(data.scheduledOn).toISOString() : undefined,
        });

        if (udfValues.length > 0 && response?.Id) {
          try {
            await saveUdfValues(0, response.Id, udfValues);
          } catch (udfError) {
            console.warn('Failed to save UDF values:', udfError);
          }
        }

        toast.success(t('calls.create_success'));
        router.push('/(app)/home' as Href);
      } catch (err) {
        console.error('Error creating call:', err);
        toast.error(t('calls.create_error'));
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedLocation, callPriorities, callTypes, toast, t, callFormData, linkedCall?.callId, udfValues, fieldPolicy, dispatchSelection]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
      // Escape to cancel
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
  }, [showLocationPicker, showAddressSelection, showDispatchModal, handleSubmit, onSubmit]);

  const handleLocationSelected = useCallback(
    (location: { latitude: number; longitude: number; address?: string }) => {
      setSelectedLocation(location);
      setShowLocationPicker(false);
      setValue('latitude', location.latitude);
      setValue('longitude', location.longitude);
      if (location.address) {
        setValue('address', location.address);
      }
      setValue('coordinates', `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
    },
    [setValue]
  );

  const handleDispatchSelection = useCallback(
    (selection: DispatchSelection) => {
      setDispatchSelection(selection);
      setValue('dispatchSelection', selection);
    },
    [setValue]
  );

  // Run card recommendation. Inert unless the department has Dispatch.RunCards enabled.
  const runCardRecommendation = useCallRecommendation({
    priorityName: watchedPriority,
    typeName: watchedType,
    latitude: selectedLocation?.latitude ?? null,
    longitude: selectedLocation?.longitude ?? null,
    callPriorities,
  });

  const handleApplyRecommendation = useCallback(() => {
    handleDispatchSelection(runCardRecommendation.applyToSelection(dispatchSelection));
  }, [runCardRecommendation, dispatchSelection, handleDispatchSelection]);

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

  const handleTemplateSelect = useCallback(
    (template: TemplateSelection) => {
      if (template.name) setValue('name', template.name);
      if (template.nature) setValue('nature', template.nature);
      if (template.type) setValue('type', template.type);
      if (template.priority) {
        const matched = callPriorities.find((p) => p.Id === template.priority);
        if (matched) setValue('priority', matched.Name);
      }
      toast.success(t('calls.templates.template_applied', 'Template applied'));
    },
    [callPriorities, setValue, toast, t]
  );

  const handleContactSelect = useCallback(
    (contact: ContactResultData) => {
      const parts = [contact.FirstName, contact.MiddleName, contact.LastName].filter(Boolean);
      const name = contact.CompanyName || parts.join(' ') || contact.Name || '';
      const info = contact.Email || String(contact.Phone || contact.Mobile || '');
      setValue('contactName', name);
      setValue('contactInfo', info);
    },
    [setValue]
  );

  const handleLinkedCallSelect = useCallback((call: CallResultData) => {
    setLinkedCall({ callId: call.CallId, number: call.Number, name: call.Name });
  }, []);

  const handleAddressSearch = async (address: string) => {
    if (!address.trim()) {
      toast.warning(t('calls.address_required'));
      return;
    }

    setIsGeocodingAddress(true);
    try {
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
          toast.success(t('calls.address_found'));
        } else {
          setAddressResults(results);
          setShowAddressSelection(true);
        }
      } else {
        toast.error(t(lookup.succeeded ? 'calls.address_not_found' : 'calls.geocoding_error'));
      }
    } catch (err) {
      console.error('Error geocoding address:', err);
      toast.error(t('calls.geocoding_error'));
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
    toast.success(t('calls.address_found'));
  };

  const handleWhat3WordsSearch = async (what3words: string) => {
    if (!what3words.trim()) {
      toast.warning(t('calls.what3words_required'));
      return;
    }

    const w3wRegex = /^[a-z]+\.[a-z]+\.[a-z]+$/;
    if (!w3wRegex.test(what3words.trim().toLowerCase())) {
      toast.warning(t('calls.what3words_invalid_format'));
      return;
    }

    setIsGeocodingWhat3Words(true);
    try {
      const lookup = await what3WordsLookup(what3words);

      if (lookup.candidates.length > 0) {
        const result = lookup.candidates[0];
        handleLocationSelected({
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          address: result.formatted_address,
        });
        toast.success(t('calls.what3words_found'));
      } else {
        toast.error(t(lookup.succeeded ? 'calls.what3words_not_found' : 'calls.what3words_geocoding_error'));
      }
    } catch (err) {
      console.error('Error geocoding what3words:', err);
      toast.error(t('calls.what3words_geocoding_error'));
    } finally {
      setIsGeocodingWhat3Words(false);
    }
  };

  const handlePlusCodeSearch = async (plusCode: string) => {
    if (!plusCode.trim()) {
      toast.warning(t('calls.plus_code_required'));
      return;
    }

    setIsGeocodingPlusCode(true);
    try {
      const lookup = await plusCodeLookup(plusCode);

      if (lookup.candidates.length > 0) {
        const result = lookup.candidates[0];
        handleLocationSelected({
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          address: result.formatted_address,
        });
        toast.success(t('calls.plus_code_found'));
      } else {
        toast.error(t(lookup.succeeded ? 'calls.plus_code_not_found' : 'calls.plus_code_geocoding_error'));
      }
    } catch (err) {
      console.error('Error geocoding plus code:', err);
      toast.error(t('calls.plus_code_geocoding_error'));
    } finally {
      setIsGeocodingPlusCode(false);
    }
  };

  const handleCoordinatesSearch = async (coordinates: string) => {
    if (!coordinates.trim()) {
      toast.warning(t('calls.coordinates_required'));
      return;
    }

    const coordRegex = /^(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)$/;
    const match = coordinates.trim().match(coordRegex);

    if (!match) {
      toast.warning(t('calls.coordinates_invalid_format'));
      return;
    }

    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      toast.warning(t('calls.coordinates_out_of_range'));
      return;
    }

    setIsGeocodingCoordinates(true);
    try {
      const lookup = await reverseGeocode(latitude, longitude);

      if (lookup.address) {
        handleLocationSelected({
          latitude,
          longitude,
          address: lookup.address,
        });
        toast.success(t('calls.coordinates_found'));
      } else {
        handleLocationSelected({ latitude, longitude });
        toast.info(t('calls.coordinates_no_address'));
      }
    } catch (err) {
      handleLocationSelected({ latitude, longitude });
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
      <View style={styles.container}>
        <Box className="m-3 mt-5 min-h-[200px] w-full max-w-[600px] gap-5 self-center rounded-lg bg-background-50 p-5">
          <Text className="error text-center">{error}</Text>
        </Box>
      </View>
    );
  }

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
      <View style={StyleSheet.flatten([styles.container, isDark ? styles.containerDark : styles.containerLight])}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={StyleSheet.flatten([styles.title, isDark ? styles.titleDark : styles.titleLight])}>{t('calls.create_new_call')}</Text>
            <Text style={StyleSheet.flatten([styles.subtitle, isDark ? styles.subtitleDark : styles.subtitleLight])}>{t('calls.new_call_web_hint', 'Fill in the call details below. Press Ctrl+Enter to create.')}</Text>
          </View>

          {/* Call Templates */}
          <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight, { marginBottom: 16 }])}>
            <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection('templates')}>
              <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0 }])}>{t('calls.templates.title', 'Call Templates')}</Text>
              <View>{sectionsExpanded.templates ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
            </Pressable>
            {sectionsExpanded.templates ? (
              <Pressable style={StyleSheet.flatten([styles.dispatchButton, isDark ? styles.dispatchButtonDark : styles.dispatchButtonLight, { marginTop: 16 }])} onPress={() => setShowTemplatesModal(true)}>
                <FileTextIcon size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                <Text style={StyleSheet.flatten([styles.dispatchButtonText, isDark ? styles.dispatchButtonTextDark : styles.dispatchButtonTextLight, { marginLeft: 8 }])}>
                  {t('calls.templates.select_template', 'Select Template')}
                </Text>
              </Pressable>
            ) : null}
          </Card>

          {/* Main Content - Two Column Layout for Wide Screens */}
          <View style={isWideScreen ? styles.twoColumnLayout : styles.singleColumnLayout}>
            {/* Left Column - Call Details */}
            <View style={isWideScreen ? styles.leftColumn : styles.fullWidth}>
              {fieldPolicy.isVisible(NewCallFieldKeys.Note) ? (
                <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                  <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection('callDetails')}>
                    <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0 }])}>{t('calls.call_details')}</Text>
                    <View>{sectionsExpanded.callDetails ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
                  </Pressable>
                  {sectionsExpanded.callDetails ? (
                    <View style={{ marginTop: 16 }}>
                      <Controller
                        control={control}
                        name="name"
                        render={({ field: { onChange, onBlur, value } }) => (
                          <WebInput
                            label={t('calls.name')}
                            placeholder={t('calls.name_placeholder')}
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            error={errors.name?.message}
                            required
                            autoFocus
                            testID="name-input"
                          />
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
                    </View>
                  ) : null}
                </Card>
              ) : null}

              {/* Schedule Dispatch */}
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection('scheduledDispatch')}>
                  <View style={styles.collapsibleHeaderLeft}>
                    <CalendarClockIcon size={18} color={isDark ? '#9ca3af' : '#6b7280'} />
                    <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0, marginLeft: 8 }])}>{t('calls.schedule_dispatch')}</Text>
                  </View>
                  <View>{sectionsExpanded.scheduledDispatch ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
                </Pressable>
                {sectionsExpanded.scheduledDispatch ? (
                  <View style={{ marginTop: 16 }}>
                    <Text style={StyleSheet.flatten([styles.webLabel, { color: isDark ? '#9ca3af' : '#6b7280', fontWeight: '400', marginBottom: 12 }])}>{t('calls.schedule_dispatch_description')}</Text>
                    <Controller
                      control={control}
                      name="scheduledOn"
                      render={({ field: { onChange, value } }) => (
                        <WebDateTimeInput
                          label={t('calls.scheduled_on')}
                          value={value || ''}
                          onChange={onChange}
                          min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                          helperText={t('calls.scheduled_on_helper')}
                          error={errors.scheduledOn?.message}
                          testID="scheduled-on-input"
                        />
                      )}
                    />
                  </View>
                ) : null}
              </Card>

              {/* Contact Information — one card holds both fields, so it shows when either is enabled. */}
              {fieldPolicy.isVisible(NewCallFieldKeys.ContactName) || fieldPolicy.isVisible(NewCallFieldKeys.ContactInfo) ? (
                <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                  <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection('contact')}>
                    <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0 }])}>{t('calls.contact_information')}</Text>
                    <View>{sectionsExpanded.contact ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
                  </Pressable>
                  {sectionsExpanded.contact ? (
                    <View style={{ marginTop: 16 }}>
                      <Pressable style={StyleSheet.flatten([styles.dispatchButton, isDark ? styles.dispatchButtonDark : styles.dispatchButtonLight, { marginBottom: 12 }])} onPress={() => setShowContactPicker(true)}>
                        <UserIcon size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                        <Text style={StyleSheet.flatten([styles.dispatchButtonText, isDark ? styles.dispatchButtonTextDark : styles.dispatchButtonTextLight, { marginLeft: 8 }])}>
                          {t('calls.contact_picker.search_placeholder', 'Search contacts...')}
                        </Text>
                      </Pressable>

                      <View style={styles.twoInputRow}>
                        {fieldPolicy.isVisible(NewCallFieldKeys.ContactName) ? (
                          <View style={styles.halfWidth}>
                            <Controller
                              control={control}
                              name="contactName"
                              render={({ field: { onChange, onBlur, value } }) => (
                                <WebInput label={t('calls.contact_name')} placeholder={t('calls.contact_name_placeholder')} value={value || ''} onChange={onChange} onBlur={onBlur} testID="contact-name-input" />
                              )}
                            />
                          </View>
                        ) : null}
                        {fieldPolicy.isVisible(NewCallFieldKeys.ContactInfo) ? (
                          <View style={styles.halfWidth}>
                            <Controller
                              control={control}
                              name="contactInfo"
                              render={({ field: { onChange, onBlur, value } }) => (
                                <WebInput label={t('calls.contact_info')} placeholder={t('calls.contact_info_placeholder')} value={value || ''} onChange={onChange} onBlur={onBlur} testID="contact-info-input" />
                              )}
                            />
                          </View>
                        ) : null}
                      </View>
                    </View>
                  ) : null}
                </Card>
              ) : null}

              {/* Call Form */}
              {callForm ? (
                <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                  <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection('callForm')}>
                    <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0 }])}>{callForm.Name || t('calls.form.title', 'Call Form')}</Text>
                    <View>{sectionsExpanded.callForm ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
                  </Pressable>
                  {sectionsExpanded.callForm ? (
                    <View style={{ marginTop: 16 }}>
                      <CallFormRenderer formSchemaJson={callForm.Data} onFormDataChange={setCallFormData} height={420} />
                    </View>
                  ) : null}
                </Card>
              ) : null}

              {/* Additional Fields (UDF) */}
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection('additionalFields')}>
                  <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0 }])}>{t('calls.additional_fields', 'Additional Fields')}</Text>
                  <View>{sectionsExpanded.additionalFields ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
                </Pressable>
                {sectionsExpanded.additionalFields ? (
                  <View style={{ marginTop: 16 }}>
                    <UdfFieldsRenderer entityType={0} onValuesChange={setUdfValues} isDark={isDark} />
                  </View>
                ) : null}
              </Card>
            </View>

            {/* Right Column - Location, Dispatch, Protocols, Linked Call */}
            <View style={isWideScreen ? styles.rightColumn : styles.fullWidth}>
              {/* Location Card */}
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection('location')}>
                  <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0 }])}>{t('calls.call_location')}</Text>
                  <View>{sectionsExpanded.location ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
                </Pressable>
                {sectionsExpanded.location ? (
                  <View style={{ marginTop: 16 }}>
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
                        <WebInput
                          label={t('calls.coordinates')}
                          placeholder={t('calls.coordinates_placeholder')}
                          value={value || ''}
                          onChange={onChange}
                          onBlur={onBlur}
                          testID="coordinates-input"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCoordinatesSearch(value || '');
                            }
                          }}
                          rightElement={
                            <Pressable
                              onPress={() => handleCoordinatesSearch(value || '')}
                              style={StyleSheet.flatten([styles.searchButton, isGeocodingCoordinates ? styles.searchButtonDisabled : {}])}
                              disabled={isGeocodingCoordinates || !value?.trim()}
                            >
                              {isGeocodingCoordinates ? <Text style={styles.searchButtonText}>...</Text> : <SearchIcon size={16} color={isDark ? '#fff' : '#000'} />}
                            </Pressable>
                          }
                        />
                      )}
                    />

                    <View style={styles.twoInputRow}>
                      <View style={styles.halfWidth}>
                        <Controller
                          control={control}
                          name="what3words"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <WebInput
                              label={t('calls.what3words')}
                              placeholder={t('calls.what3words_placeholder')}
                              value={value || ''}
                              onChange={onChange}
                              onBlur={onBlur}
                              testID="what3words-input"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleWhat3WordsSearch(value || '');
                                }
                              }}
                              rightElement={
                                <Pressable
                                  onPress={() => handleWhat3WordsSearch(value || '')}
                                  style={StyleSheet.flatten([styles.searchButton, isGeocodingWhat3Words ? styles.searchButtonDisabled : {}])}
                                  disabled={isGeocodingWhat3Words || !value?.trim()}
                                >
                                  {isGeocodingWhat3Words ? <Text style={styles.searchButtonText}>...</Text> : <SearchIcon size={16} color={isDark ? '#fff' : '#000'} />}
                                </Pressable>
                              }
                            />
                          )}
                        />
                      </View>
                      <View style={styles.halfWidth}>
                        <Controller
                          control={control}
                          name="plusCode"
                          render={({ field: { onChange, onBlur, value } }) => (
                            <WebInput
                              label={t('calls.plus_code')}
                              placeholder={t('calls.plus_code_placeholder')}
                              value={value || ''}
                              onChange={onChange}
                              onBlur={onBlur}
                              testID="plus-code-input"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handlePlusCodeSearch(value || '');
                                }
                              }}
                              rightElement={
                                <Pressable
                                  onPress={() => handlePlusCodeSearch(value || '')}
                                  style={StyleSheet.flatten([styles.searchButton, isGeocodingPlusCode ? styles.searchButtonDisabled : {}])}
                                  disabled={isGeocodingPlusCode || !value?.trim()}
                                >
                                  {isGeocodingPlusCode ? <Text style={styles.searchButtonText}>...</Text> : <SearchIcon size={16} color={isDark ? '#fff' : '#000'} />}
                                </Pressable>
                              }
                            />
                          )}
                        />
                      </View>
                    </View>

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
                    {isLoadingDestinationPois ? (
                      <Text style={StyleSheet.flatten([styles.webLabel, isDark ? styles.webLabelDark : styles.webLabelLight, { marginTop: -4 }])}>{t('calls.loading_destination_pois')}</Text>
                    ) : null}
                    {!isLoadingDestinationPois && destinationPois.length === 0 ? (
                      <Text style={StyleSheet.flatten([styles.webLabel, isDark ? styles.webLabelDark : styles.webLabelLight, { marginTop: -4 }])}>{t('calls.no_destination_pois_available')}</Text>
                    ) : null}
                  </View>
                ) : null}
              </Card>

              {/* Dispatch Card */}
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection('dispatch')}>
                  <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0 }])}>{t('calls.dispatch_to')}</Text>
                  <View>{sectionsExpanded.dispatch ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
                </Pressable>
                {sectionsExpanded.dispatch ? (
                  <View style={{ marginTop: 16 }}>
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
                    <Pressable style={StyleSheet.flatten([styles.dispatchButton, isDark ? styles.dispatchButtonDark : styles.dispatchButtonLight])} onPress={() => setShowDispatchModal(true)}>
                      <Text style={StyleSheet.flatten([styles.dispatchButtonText, isDark ? styles.dispatchButtonTextDark : styles.dispatchButtonTextLight])}>{getDispatchSummary()}</Text>
                      <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />
                    </Pressable>
                  </View>
                ) : null}
              </Card>

              {/* Protocols */}
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection('protocols')}>
                  <View style={styles.collapsibleHeaderLeft}>
                    <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0 }])}>{t('calls.protocols.title', 'Protocols')}</Text>
                    {selectedProtocols.length > 0 ? (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{selectedProtocols.length}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View>{sectionsExpanded.protocols ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
                </Pressable>
                {sectionsExpanded.protocols ? (
                  <Pressable style={StyleSheet.flatten([styles.dispatchButton, isDark ? styles.dispatchButtonDark : styles.dispatchButtonLight, { marginTop: 16 }])} onPress={() => setShowProtocolSelector(true)}>
                    <BookOpenIcon size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                    <Text style={StyleSheet.flatten([styles.dispatchButtonText, isDark ? styles.dispatchButtonTextDark : styles.dispatchButtonTextLight, { marginLeft: 8 }])}>
                      {selectedProtocols.length > 0 ? `${selectedProtocols.length} ${t('calls.protocols.selected_count', 'selected')}` : t('calls.protocols.select', 'Select Protocols')}
                    </Text>
                  </Pressable>
                ) : null}
              </Card>

              {/* Linked Call */}
              <Card style={StyleSheet.flatten([styles.card, isDark ? styles.cardDark : styles.cardLight])}>
                <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection('linkedCall')}>
                  <View style={styles.collapsibleHeaderLeft}>
                    <Text style={StyleSheet.flatten([styles.sectionTitle, isDark ? styles.sectionTitleDark : styles.sectionTitleLight, { marginBottom: 0 }])}>{t('calls.linked_calls.title', 'Linked Call')}</Text>
                    {linkedCall ? (
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>#{linkedCall.number}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View>{sectionsExpanded.linkedCall ? <ChevronUpIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} /> : <ChevronDownIcon size={20} color={isDark ? '#9ca3af' : '#6b7280'} />}</View>
                </Pressable>
                {sectionsExpanded.linkedCall ? (
                  <View style={{ marginTop: 16 }}>
                    {linkedCall ? (
                      <View style={StyleSheet.flatten([styles.linkedCallBadge, isDark ? styles.linkedCallBadgeDark : styles.linkedCallBadgeLight])}>
                        <Text style={StyleSheet.flatten([styles.linkedCallText, isDark ? styles.linkedCallTextDark : styles.linkedCallTextLight])}>
                          #{linkedCall.number} — {linkedCall.name}
                        </Text>
                        <Pressable onPress={() => setLinkedCall(null)}>
                          <XIcon size={16} color="#ef4444" />
                        </Pressable>
                      </View>
                    ) : null}
                    <Pressable style={StyleSheet.flatten([styles.dispatchButton, isDark ? styles.dispatchButtonDark : styles.dispatchButtonLight])} onPress={() => setShowLinkedCallsModal(true)}>
                      <LinkIcon size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
                      <Text style={StyleSheet.flatten([styles.dispatchButtonText, isDark ? styles.dispatchButtonTextDark : styles.dispatchButtonTextLight, { marginLeft: 8 }])}>
                        {linkedCall ? t('calls.linked_calls.change', 'Change linked call') : t('calls.linked_calls.select', 'Link to existing call')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable style={StyleSheet.flatten([styles.cancelButton, isDark ? styles.cancelButtonDark : styles.cancelButtonLight])} onPress={() => router.back()}>
              <Text style={StyleSheet.flatten([styles.cancelButtonText, isDark ? styles.cancelButtonTextDark : styles.cancelButtonTextLight])}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              style={StyleSheet.flatten([styles.submitButton, isSubmitting || !fieldPolicy.isLoaded ? styles.submitButtonDisabled : {}])}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting || !fieldPolicy.isLoaded}
            >
              <PlusIcon size={18} color="#fff" />
              <Text style={styles.submitButtonText}>{isSubmitting ? t('common.creating') : t('calls.create')}</Text>
            </Pressable>
          </View>

          {/* Keyboard Shortcut Hint */}
          <View style={styles.shortcutHint}>
            <Text style={StyleSheet.flatten([styles.shortcutText, isDark ? styles.shortcutTextDark : styles.shortcutTextLight])}>{t('calls.keyboard_shortcuts', 'Tip: Press Ctrl+Enter to create, Escape to cancel')}</Text>
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

      {/* Call Templates modal */}
      <CallTemplatesModal isVisible={showTemplatesModal} onClose={() => setShowTemplatesModal(false)} onSelect={handleTemplateSelect} />

      {/* Contact Picker modal */}
      <ContactPickerModal isVisible={showContactPicker} onClose={() => setShowContactPicker(false)} onSelect={handleContactSelect} />

      {/* Protocol Selector modal */}
      <ProtocolSelectorModal isVisible={showProtocolSelector} onClose={() => setShowProtocolSelector(false)} onConfirm={setSelectedProtocols} initialSelected={selectedProtocols} />

      {/* Linked Calls modal */}
      <LinkedCallsModal isVisible={showLinkedCallsModal} onClose={() => setShowLinkedCallsModal(false)} onSelect={handleLinkedCallSelect} selectedCallId={linkedCall?.callId} />

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
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  titleDark: {
    color: '#ffffff',
  },
  titleLight: {
    color: '#111827',
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
  linkedCallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
  },
  linkedCallBadgeDark: {
    backgroundColor: '#262626',
    borderColor: '#404040',
  },
  linkedCallBadgeLight: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  linkedCallText: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  linkedCallTextDark: {
    color: '#d1d5db',
  },
  linkedCallTextLight: {
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
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 0,
  },
  collapsibleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    marginLeft: 8,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
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
    cursor: 'pointer',
  },
};
