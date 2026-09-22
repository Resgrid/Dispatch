import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Camera, FileUp, Images, MapPin, RefreshCw, Trash2, TriangleAlert } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { getRecordAttachments, type RecordAttachmentData, removeRecordAttachment } from '@/api/records/record-uploads';
import { Badge, BadgeText } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Divider } from '@/components/ui/divider';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Pressable } from '@/components/ui/pressable';
import { Progress, ProgressFilledTrack } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { logger } from '@/lib/logging';
import { fileSize, hashFile } from '@/lib/records/uploads';
import { useRecordsStore } from '@/stores/records/store';

// Attachment capture for a Record (RMS plan RMS-1D). Capture from the camera, the library or a file,
// then upload in chunks against a server-owned session so an interruption resumes rather than
// restarts. What happened to a photo's location metadata is shown on the attachment, not implied.

interface RecordAttachmentsProps {
  recordId: string;
  /** From the catalog entry; false hides capture entirely rather than failing at upload. */
  allowAttachments: boolean;
  readOnly?: boolean;
}

const localId = () => `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const guessContentType = (name: string, fallback?: string | null): string => {
  const extension = (name.split('.').pop() ?? '').toLowerCase();
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'heic':
      return 'image/heic';
    case 'pdf':
      return 'application/pdf';
    default:
      return fallback && fallback.length > 0 ? fallback : 'application/octet-stream';
  }
};

export const RecordAttachments: React.FC<RecordAttachmentsProps> = ({ recordId, allowAttachments, readOnly }) => {
  const { t } = useTranslation();
  const pendingUploads = useRecordsStore((state) => state.pendingUploads);
  const stageUpload = useRecordsStore((state) => state.stageUpload);
  const runUploads = useRecordsStore((state) => state.runUploads);
  const retryUpload = useRecordsStore((state) => state.retryUpload);
  const discardUpload = useRecordsStore((state) => state.discardUpload);
  const uploadProgress = useRecordsStore((state) => state.uploadProgress);

  const [attachments, setAttachments] = useState<RecordAttachmentData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const pending = Object.values(pendingUploads).filter((upload) => upload.recordId === recordId);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getRecordAttachments(recordId);
      setAttachments(response?.Data ?? []);
    } catch (error) {
      logger.error({ message: 'Record attachments could not be listed', context: { error, recordId } });
    } finally {
      setIsLoading(false);
    }
  }, [recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stage = useCallback(
    async (uri: string, name: string, contentType: string) => {
      setMessage(null);
      try {
        const size = await fileSize(uri);
        if (size <= 0) {
          setMessage(t('records.attachment_unreadable'));
          return;
        }
        const sha256 = await hashFile(uri);
        stageUpload({
          localId: localId(),
          recordId,
          uploadId: null,
          fileUri: uri,
          fileName: name,
          contentType,
          byteSize: size,
          sha256,
          sentBytes: 0,
          classification: 1,
          createdOn: new Date().toISOString(),
        });
        const outcome = await runUploads(recordId);
        if (outcome.uploaded > 0) {
          await load();
        }
        if (outcome.failed > 0) {
          setMessage(t('records.attachment_failed'));
        }
      } catch (error) {
        logger.error({ message: 'Record attachment could not be staged', context: { error, recordId } });
        setMessage(t('records.attachment_failed'));
      }
    },
    [recordId, stageUpload, runUploads, load, t]
  );

  const pickFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMessage(t('records.camera_denied'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.8, exif: false });
    const asset = result.canceled ? null : result.assets?.[0];
    if (asset?.uri) {
      await stage(asset.uri, asset.fileName ?? `photo-${Date.now()}.jpg`, guessContentType(asset.fileName ?? '.jpg', asset.mimeType));
    }
  }, [stage, t]);

  const pickFromLibrary = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      exif: false,
      ...(Platform.OS === 'ios' && { preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible }),
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (asset?.uri) {
      await stage(asset.uri, asset.fileName ?? `image-${Date.now()}.jpg`, guessContentType(asset.fileName ?? '.jpg', asset.mimeType));
    }
  }, [stage]);

  const pickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    const asset = result.canceled ? null : result.assets?.[0];
    if (asset?.uri) {
      await stage(asset.uri, asset.name ?? `file-${Date.now()}`, guessContentType(asset.name ?? '', asset.mimeType));
    }
  }, [stage]);

  const remove = useCallback(
    async (attachmentId: string) => {
      try {
        await removeRecordAttachment(recordId, attachmentId);
        await load();
      } catch (error) {
        logger.error({ message: 'Record attachment could not be removed', context: { error, recordId, attachmentId } });
        setMessage(t('records.attachment_failed'));
      }
    },
    [recordId, load, t]
  );

  if (!allowAttachments) {
    return null;
  }

  return (
    <Box className="mt-4 rounded-md border border-outline-200 p-3" testID="record-attachments">
      <HStack className="items-center justify-between">
        <Heading size="xs">{t('records.attachments')}</Heading>
        {isLoading ? <Spinner size="small" /> : null}
      </HStack>

      {message ? <Text className="mt-2 text-sm text-error-600">{message}</Text> : null}

      {attachments.length === 0 && pending.length === 0 ? <Text className="mt-2 text-sm text-typography-500">{t('records.no_attachments')}</Text> : null}

      {attachments.map((attachment) => (
        <React.Fragment key={attachment.AttachmentId}>
          <HStack className="items-center py-2" space="sm">
            <VStack className="flex-1">
              <Text className="text-sm font-medium text-typography-900" numberOfLines={1}>
                {attachment.FileName}
              </Text>
              <HStack space="xs" className="mt-1 items-center">
                {/* The person is told what happened to the photo's location rather than left to guess. */}
                {attachment.MediaLocationRetained ? (
                  <Badge action="warning" size="sm">
                    <MapPin size={11} color="#b45309" />
                    <BadgeText className="ml-1">{t('records.location_kept')}</BadgeText>
                  </Badge>
                ) : attachment.MetadataStripped ? (
                  <Badge action="muted" size="sm">
                    <BadgeText>{t('records.location_removed')}</BadgeText>
                  </Badge>
                ) : null}
              </HStack>
            </VStack>
            {!readOnly ? (
              <Pressable onPress={() => void remove(attachment.AttachmentId)} testID={`record-attachment-remove-${attachment.AttachmentId}`}>
                <Trash2 size={16} color="#dc2626" />
              </Pressable>
            ) : null}
          </HStack>
          <Divider />
        </React.Fragment>
      ))}

      {pending.map((upload) => {
        const progress = uploadProgress[upload.localId] ?? upload.sentBytes;
        const percent = upload.byteSize > 0 ? Math.min(100, Math.round((progress / upload.byteSize) * 100)) : 0;
        return (
          <VStack key={upload.localId} className="py-2" space="xs">
            <HStack className="items-center" space="sm">
              <VStack className="flex-1">
                <Text className="text-sm text-typography-900" numberOfLines={1}>
                  {upload.fileName}
                </Text>
                <Text className="text-xs text-typography-500">{upload.isUnrecoverable ? t('records.attachment_file_missing') : upload.lastError ? t('records.attachment_will_resume') : `${percent}%`}</Text>
              </VStack>
              {upload.lastError && !upload.isUnrecoverable ? (
                <Pressable onPress={() => void retryUpload(upload.localId)} testID={`record-upload-retry-${upload.localId}`}>
                  <RefreshCw size={16} color="#2563eb" />
                </Pressable>
              ) : null}
              {upload.isUnrecoverable ? <TriangleAlert size={16} color="#d97706" /> : null}
              <Pressable onPress={() => void discardUpload(upload.localId)} testID={`record-upload-discard-${upload.localId}`}>
                <Trash2 size={16} color="#dc2626" />
              </Pressable>
            </HStack>
            {!upload.isUnrecoverable ? (
              <Progress value={percent} size="xs">
                <ProgressFilledTrack />
              </Progress>
            ) : null}
          </VStack>
        );
      })}

      {!readOnly ? (
        <HStack space="sm" className="mt-3 flex-wrap">
          <Button size="sm" variant="outline" onPress={() => void pickFromCamera()} testID="record-attachment-camera">
            <ButtonIcon as={Camera} />
            <ButtonText>{t('records.take_photo')}</ButtonText>
          </Button>
          <Button size="sm" variant="outline" onPress={() => void pickFromLibrary()} testID="record-attachment-library">
            <ButtonIcon as={Images} />
            <ButtonText>{t('records.choose_photo')}</ButtonText>
          </Button>
          <Button size="sm" variant="outline" onPress={() => void pickFile()} testID="record-attachment-file">
            <ButtonIcon as={FileUp} />
            <ButtonText>{t('records.choose_file')}</ButtonText>
          </Button>
        </HStack>
      ) : null}
    </Box>
  );
};
