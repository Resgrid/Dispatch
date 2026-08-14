import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { CustomBottomSheet } from '@/components/ui/bottom-sheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { FormControl, FormControlError, FormControlLabel, FormControlLabelText } from '@/components/ui/form-control';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
import { Select, SelectBackdrop, SelectContent, SelectIcon, SelectInput, SelectItem, SelectPortal, SelectTrigger } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { Textarea, TextareaInput } from '@/components/ui/textarea';
import { VStack } from '@/components/ui/vstack';
import { CallVideoFeedFormat, CallVideoFeedStatus, CallVideoFeedType } from '@/models/v4/callVideoFeeds/callVideoFeedEnums';
import { type CallVideoFeedResultData } from '@/models/v4/callVideoFeeds/callVideoFeedResultData';
import { useLocationStore } from '@/stores/app/location-store';
import { useCallVideoFeedsStore } from '@/stores/callVideoFeeds/store';
import { useToastStore } from '@/stores/toast/store';

interface VideoFeedFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
  editFeed?: CallVideoFeedResultData | null;
}

function autoDetectFormat(url: string): string | undefined {
  if (!url) return undefined;
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8')) return 'HLS';
  if (lower.startsWith('rtsp://')) return 'RTSP';
  if (lower.includes('youtube.com/live') || lower.includes('youtu.be') || lower.includes('youtube.com/watch')) return 'YouTubeLive';
  if (lower.includes('.mpd')) return 'DASH';
  if (lower.includes('mjpeg') || lower.includes('mjpg')) return 'MJPEG';
  return undefined;
}

const FEED_TYPE_OPTIONS = [
  { value: 'Drone', numericValue: CallVideoFeedType.Drone, labelKey: 'videoFeeds.type.drone' },
  { value: 'FixedCamera', numericValue: CallVideoFeedType.FixedCamera, labelKey: 'videoFeeds.type.fixedCamera' },
  { value: 'BodyCam', numericValue: CallVideoFeedType.BodyCam, labelKey: 'videoFeeds.type.bodyCam' },
  { value: 'TrafficCam', numericValue: CallVideoFeedType.TrafficCam, labelKey: 'videoFeeds.type.trafficCam' },
  { value: 'WeatherCam', numericValue: CallVideoFeedType.WeatherCam, labelKey: 'videoFeeds.type.weatherCam' },
  { value: 'SatelliteFeed', numericValue: CallVideoFeedType.SatelliteFeed, labelKey: 'videoFeeds.type.satelliteFeed' },
  { value: 'WebCam', numericValue: CallVideoFeedType.WebCam, labelKey: 'videoFeeds.type.webCam' },
  { value: 'Other', numericValue: CallVideoFeedType.Other, labelKey: 'videoFeeds.type.other' },
];

const FEED_FORMAT_OPTIONS = [
  { value: 'RTSP', numericValue: CallVideoFeedFormat.RTSP, labelKey: 'videoFeeds.format.rtsp' },
  { value: 'HLS', numericValue: CallVideoFeedFormat.HLS, labelKey: 'videoFeeds.format.hls' },
  { value: 'MJPEG', numericValue: CallVideoFeedFormat.MJPEG, labelKey: 'videoFeeds.format.mjpeg' },
  { value: 'YouTubeLive', numericValue: CallVideoFeedFormat.YouTubeLive, labelKey: 'videoFeeds.format.youtubeLive' },
  { value: 'WebRTC', numericValue: CallVideoFeedFormat.WebRTC, labelKey: 'videoFeeds.format.webrtc' },
  { value: 'DASH', numericValue: CallVideoFeedFormat.DASH, labelKey: 'videoFeeds.format.dash' },
  { value: 'Embed', numericValue: CallVideoFeedFormat.Embed, labelKey: 'videoFeeds.format.embed' },
  { value: 'Other_Format', numericValue: CallVideoFeedFormat.Other, labelKey: 'videoFeeds.format.other' },
];

const FEED_STATUS_OPTIONS = [
  { value: 'Active', numericValue: CallVideoFeedStatus.Active, labelKey: 'videoFeeds.status.active' },
  { value: 'Inactive', numericValue: CallVideoFeedStatus.Inactive, labelKey: 'videoFeeds.status.inactive' },
  { value: 'Error', numericValue: CallVideoFeedStatus.Error, labelKey: 'videoFeeds.status.error' },
];

function feedTypeNumToName(num: number | null): string {
  return FEED_TYPE_OPTIONS.find((o) => o.numericValue === num)?.value ?? 'Other';
}

function feedFormatNumToName(num: number | null): string {
  return FEED_FORMAT_OPTIONS.find((o) => o.numericValue === num)?.value ?? 'Other_Format';
}

function feedStatusNumToName(num: number): string {
  return FEED_STATUS_OPTIONS.find((o) => o.numericValue === num)?.value ?? 'Active';
}

function feedTypeNameToNum(name: string): number {
  return FEED_TYPE_OPTIONS.find((o) => o.value === name)?.numericValue ?? CallVideoFeedType.Other;
}

function feedFormatNameToNum(name: string): number {
  return FEED_FORMAT_OPTIONS.find((o) => o.value === name)?.numericValue ?? CallVideoFeedFormat.Other;
}

function feedStatusNameToNum(name: string): number {
  return FEED_STATUS_OPTIONS.find((o) => o.value === name)?.numericValue ?? CallVideoFeedStatus.Active;
}

export const VideoFeedFormSheet: React.FC<VideoFeedFormSheetProps> = ({ isOpen, onClose, callId, editFeed }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const showToast = useToastStore((state) => state.showToast);
  const { addFeed, updateFeed, isSaving } = useCallVideoFeedsStore();
  // Selected field by field: an object selector builds a new reference on every store
  // write, so this re-rendered on every GPS fix.
  const userLatitude = useLocationStore((state) => state.latitude);
  const userLongitude = useLocationStore((state) => state.longitude);

  const isEditing = !!editFeed;

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [feedType, setFeedType] = useState<string>('Other');
  const [feedFormat, setFeedFormat] = useState<string>('Other_Format');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<string>('Active');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});

  useEffect(() => {
    if (isOpen) {
      if (editFeed) {
        setName(editFeed.Name);
        setUrl(editFeed.Url);
        setFeedType(feedTypeNumToName(editFeed.FeedType));
        setFeedFormat(feedFormatNumToName(editFeed.FeedFormat));
        setDescription(editFeed.Description || '');
        setStatus(feedStatusNumToName(editFeed.Status));
        setLatitude(editFeed.Latitude != null ? String(editFeed.Latitude) : '');
        setLongitude(editFeed.Longitude != null ? String(editFeed.Longitude) : '');
        setSortOrder(String(editFeed.SortOrder));
      } else {
        setName('');
        setUrl('');
        setFeedType('Other');
        setFeedFormat('Other_Format');
        setDescription('');
        setStatus('Active');
        setLatitude('');
        setLongitude('');
        setSortOrder('0');
      }
      setErrors({});
    }
  }, [isOpen, editFeed]);

  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    const detected = autoDetectFormat(newUrl);
    if (detected !== undefined) {
      setFeedFormat(String(detected));
    }
  };

  const handleUseCurrentLocation = () => {
    if (userLatitude && userLongitude) {
      setLatitude(String(userLatitude));
      setLongitude(String(userLongitude));
    }
  };

  const validate = (): boolean => {
    const newErrors: { name?: string; url?: string } = {};
    if (!name.trim()) newErrors.name = t('videoFeeds.form.name') + ' is required';
    if (!url.trim()) newErrors.url = t('videoFeeds.form.url') + ' is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    if (isEditing && editFeed) {
      const success = await updateFeed({
        CallVideoFeedId: editFeed.CallVideoFeedId,
        CallId: callId,
        Name: name.trim(),
        Url: url.trim(),
        FeedType: feedTypeNameToNum(feedType),
        FeedFormat: feedFormatNameToNum(feedFormat),
        Description: description.trim() || undefined,
        Status: feedStatusNameToNum(status),
        Latitude: latitude || undefined,
        Longitude: longitude || undefined,
        SortOrder: parseInt(sortOrder) || 0,
      });
      if (success) {
        showToast('success', t('videoFeeds.feedUpdated'));
        onClose();
      } else {
        showToast('error', t('videoFeeds.feedError'));
      }
    } else {
      const feedId = await addFeed({
        CallId: callId,
        Name: name.trim(),
        Url: url.trim(),
        FeedType: feedTypeNameToNum(feedType),
        FeedFormat: feedFormatNameToNum(feedFormat),
        Description: description.trim() || undefined,
        Latitude: latitude || undefined,
        Longitude: longitude || undefined,
        SortOrder: parseInt(sortOrder) || 0,
      });
      if (feedId) {
        showToast('success', t('videoFeeds.feedAdded'));
        onClose();
      } else {
        showToast('error', t('videoFeeds.feedError'));
      }
    }
  };

  return (
    <CustomBottomSheet isOpen={isOpen} onClose={onClose} snapPoints={[85]} isLoading={isSaving}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <VStack className="gap-4 p-2">
          <Heading size="md">{isEditing ? t('videoFeeds.editFeed') : t('videoFeeds.addFeed')}</Heading>

          {/* Name */}
          <FormControl isInvalid={!!errors.name}>
            <FormControlLabel>
              <FormControlLabelText>{t('videoFeeds.form.name')} *</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField value={name} onChangeText={setName} placeholder={t('videoFeeds.form.namePlaceholder')} />
            </Input>
            {errors.name && (
              <FormControlError>
                <Text className="text-xs text-red-500">{errors.name}</Text>
              </FormControlError>
            )}
          </FormControl>

          {/* URL */}
          <FormControl isInvalid={!!errors.url}>
            <FormControlLabel>
              <FormControlLabelText>{t('videoFeeds.form.url')} *</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField value={url} onChangeText={handleUrlChange} placeholder={t('videoFeeds.form.urlPlaceholder')} autoCapitalize="none" keyboardType="url" />
            </Input>
            {errors.url && (
              <FormControlError>
                <Text className="text-xs text-red-500">{errors.url}</Text>
              </FormControlError>
            )}
          </FormControl>

          {/* Feed Type */}
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t('videoFeeds.form.feedType')}</FormControlLabelText>
            </FormControlLabel>
            <Select selectedValue={feedType} onValueChange={setFeedType}>
              <SelectTrigger>
                <SelectInput placeholder={t('videoFeeds.form.feedType')} />
                <SelectIcon />
              </SelectTrigger>
              <SelectPortal>
                <SelectBackdrop />
                <SelectContent>
                  {FEED_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} label={t(opt.labelKey)} value={opt.value} />
                  ))}
                </SelectContent>
              </SelectPortal>
            </Select>
          </FormControl>

          {/* Feed Format */}
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t('videoFeeds.form.feedFormat')}</FormControlLabelText>
            </FormControlLabel>
            <Select selectedValue={feedFormat} onValueChange={setFeedFormat}>
              <SelectTrigger>
                <SelectInput placeholder={t('videoFeeds.form.feedFormat')} />
                <SelectIcon />
              </SelectTrigger>
              <SelectPortal>
                <SelectBackdrop />
                <SelectContent>
                  {FEED_FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} label={t(opt.labelKey)} value={opt.value} />
                  ))}
                </SelectContent>
              </SelectPortal>
            </Select>
          </FormControl>

          {/* Description */}
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t('videoFeeds.form.description')}</FormControlLabelText>
            </FormControlLabel>
            <Textarea>
              <TextareaInput value={description} onChangeText={setDescription} placeholder={t('videoFeeds.form.descriptionPlaceholder')} />
            </Textarea>
          </FormControl>

          {/* Status (edit only) */}
          {isEditing && (
            <FormControl>
              <FormControlLabel>
                <FormControlLabelText>{t('videoFeeds.form.status')}</FormControlLabelText>
              </FormControlLabel>
              <Select selectedValue={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectInput placeholder={t('videoFeeds.form.status')} />
                  <SelectIcon />
                </SelectTrigger>
                <SelectPortal>
                  <SelectBackdrop />
                  <SelectContent>
                    {FEED_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} label={t(opt.labelKey)} value={opt.value} />
                    ))}
                  </SelectContent>
                </SelectPortal>
              </Select>
            </FormControl>
          )}

          {/* Camera Location */}
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t('videoFeeds.form.cameraLocation')}</FormControlLabelText>
            </FormControlLabel>
            <HStack className="gap-2">
              <Box className="flex-1">
                <Input>
                  <InputField value={latitude} onChangeText={setLatitude} placeholder="Latitude" keyboardType="decimal-pad" />
                </Input>
              </Box>
              <Box className="flex-1">
                <Input>
                  <InputField value={longitude} onChangeText={setLongitude} placeholder="Longitude" keyboardType="decimal-pad" />
                </Input>
              </Box>
            </HStack>
            <Button variant="link" size="sm" onPress={handleUseCurrentLocation} className="mt-1 self-start">
              <ButtonText className="text-xs">{t('videoFeeds.form.useCurrentLocation')}</ButtonText>
            </Button>
          </FormControl>

          {/* Sort Order */}
          <FormControl>
            <FormControlLabel>
              <FormControlLabelText>{t('videoFeeds.form.sortOrder')}</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField value={sortOrder} onChangeText={setSortOrder} keyboardType="number-pad" />
            </Input>
          </FormControl>

          {/* Submit */}
          <HStack className="mt-2 gap-3">
            <Button variant="outline" className="flex-1" onPress={onClose}>
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button className="flex-1" onPress={handleSubmit} isDisabled={isSaving}>
              <ButtonText>{isSaving ? t('common.saving') : isEditing ? t('common.save') : t('videoFeeds.addFeed')}</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </ScrollView>
    </CustomBottomSheet>
  );
};
