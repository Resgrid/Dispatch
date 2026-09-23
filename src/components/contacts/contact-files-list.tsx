import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { DownloadIcon, FileIcon, LockIcon, PaperclipIcon } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';

import { getContactFileBase64 } from '@/api/contacts/contactFiles';
import { ProtectedText } from '@/components/data-protection/protected-text';
import { Box } from '@/components/ui/box';
import { Button, ButtonIcon } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { isFieldRedacted } from '@/lib/data-protection/redacted';
import { logger } from '@/lib/logging';
import { type ContactFileResultData } from '@/models/v4/contactFiles/contactFilesResult';

/** ADP catalog v12 field ids for a contact file's cataloged text. */
const FileFieldIds = {
  name: 'contactattachments.name',
  fileName: 'contactattachments.filename',
} as const;

/**
 * Reduces a server-supplied file name to one path segment. The name is written straight under the
 * document directory, so a separator or a `..` segment in it would resolve outside that directory
 * and could overwrite another of the app's files. Anything that is not a plain name falls back to
 * an id-based one.
 */
export const safeFileName = (fileName: string | null | undefined, fallback: string): string => {
  const lastSegment = (fileName ?? '').split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = lastSegment
    .replace(/[\x00-\x1f<>:"|?*]/g, '')
    .replace(/^\.+/, '')
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
};

const formatSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

interface ContactFilesListProps {
  files: ContactFileResultData[];
  isLoading?: boolean;
  /** Analytics context: the contact or call the list belongs to. */
  contextId?: string;
  emptyText?: string;
}

/**
 * Site files of a contact (Contacts plan Phase A): download-and-share, the same flow as call files. A
 * protected file has no anonymous link and downloads through the grant-gated data path; when the
 * server withholds it, the row shows the lock and the download is refused rather than served as bytes.
 */
export const ContactFilesList: React.FC<ContactFilesListProps> = ({ files, isLoading, contextId, emptyText }) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const handleDownload = useCallback(
    async (file: ContactFileResultData) => {
      if (downloading[file.Id]) return;
      setDownloading((prev) => ({ ...prev, [file.Id]: true }));
      trackEvent('contact_file_download_started', { contextId: contextId ?? '', fileId: file.Id, fileType: file.Type, isProtected: file.IsProtected });

      try {
        const base64 = await getContactFileBase64(file);
        const fallbackName = `contact_file_${file.Id}`;
        const fileName = safeFileName(isFieldRedacted(file.RedactedFields, FileFieldIds.fileName, file.FileName) ? null : file.FileName, fallbackName);

        if (Platform.OS === 'web') {
          // The dispatch console runs in a browser: there is no document directory or share sheet, so the
          // bytes become a browser download. The object URL is always revoked, even when the click throws.
          let objectUrl: string | null = null;
          let link: HTMLAnchorElement | null = null;
          try {
            const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
            objectUrl = URL.createObjectURL(new Blob([bytes], { type: file.Mime || 'application/octet-stream' }));
            link = document.createElement('a');
            link.href = objectUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
          } finally {
            link?.remove();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
          }
          trackEvent('contact_file_download_completed', { contextId: contextId ?? '', fileId: file.Id, wasShared: false });
          return;
        }

        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: file.Mime || 'application/octet-stream', dialogTitle: file.Name || fileName });
          trackEvent('contact_file_download_completed', { contextId: contextId ?? '', fileId: file.Id, wasShared: true });
        } else {
          Alert.alert(t('contacts.files.share_unavailable'));
          trackEvent('contact_file_download_completed', { contextId: contextId ?? '', fileId: file.Id, wasShared: false });
        }
      } catch (error) {
        logger.error({ message: 'Failed to download contact file', context: { error, fileId: file.Id } });
        Alert.alert(t('contacts.files.download_failed'));
      } finally {
        setDownloading((prev) => {
          const next = { ...prev };
          delete next[file.Id];
          return next;
        });
      }
    },
    [contextId, downloading, t, trackEvent]
  );

  if (isLoading) {
    return (
      <Box className="flex-1 items-center justify-center py-8" testID="contact-files-loading">
        <Spinner size="large" className="mb-4" />
        <Text className="text-center text-gray-500 dark:text-gray-400">{t('contacts.files.loading')}</Text>
      </Box>
    );
  }

  if (!files || files.length === 0) {
    return (
      <Box className="flex-1 items-center justify-center py-8" testID="contact-files-empty">
        <VStack space="md" className="items-center">
          <Box className="size-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <PaperclipIcon size={32} color="#6b7280" />
          </Box>
          <Text className="text-center text-gray-500 dark:text-gray-400">{emptyText ?? t('contacts.files.empty')}</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <VStack space="sm" className="p-4" testID="contact-files-list">
      {files.map((file) => {
        const concealed = file.IsProtected && isFieldRedacted(file.RedactedFields, FileFieldIds.name, file.Name);
        return (
          <HStack key={file.Id} space="sm" className="items-center rounded-lg border border-gray-200 p-3 dark:border-gray-700" testID={`contact-file-${file.Id}`}>
            <Box className="size-10 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800">{concealed ? <LockIcon size={20} color="#6b7280" /> : <FileIcon size={20} color="#6366F1" />}</Box>
            <VStack className="flex-1">
              <ProtectedText value={file.Name} fieldId={FileFieldIds.name} redactedFields={file.RedactedFields} className="text-sm font-medium text-gray-900 dark:text-white" />
              <Text className="text-xs text-gray-500 dark:text-gray-400">
                {file.TypeName} · {formatSize(file.Size)}
                {file.Timestamp ? ` · ${file.Timestamp}` : ''}
              </Text>
            </VStack>
            {concealed ? null : (
              <Button variant="outline" size="sm" onPress={() => handleDownload(file)} isDisabled={!!downloading[file.Id]} testID={`contact-file-download-${file.Id}`}>
                {downloading[file.Id] ? <Spinner size="small" /> : <ButtonIcon as={DownloadIcon} />}
              </Button>
            )}
          </HStack>
        );
      })}
    </VStack>
  );
};
