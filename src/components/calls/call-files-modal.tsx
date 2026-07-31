import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Download, File, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { getCallAttachmentFile } from '@/api/calls/callFiles';
import { Box } from '@/components/ui/box';
import { Button } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useAnalytics } from '@/hooks/use-analytics';
import { type CallFileResultData } from '@/models/v4/callFiles/callFileResultData';
import { useCallDetailStore } from '@/stores/calls/detail-store';

import { FocusAwareStatusBar } from '../ui';

interface CallFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

export const CallFilesModal: React.FC<CallFilesModalProps> = ({ isOpen, onClose, callId }) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { callFiles, isLoadingFiles, errorFiles, fetchCallFiles } = useCallDetailStore();
  const [downloadingFiles, setDownloadingFiles] = useState<Record<string, number>>({});

  // Bottom sheet ref and snap points
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['67%'], []);

  // Handle modal open/close
  useEffect(() => {
    if (isOpen) {
      bottomSheetRef.current?.expand();
      fetchCallFiles(callId);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [isOpen, callId, fetchCallFiles]);

  // Track when call files modal is opened/rendered
  useEffect(() => {
    if (isOpen) {
      trackEvent('call_files_modal_opened', {
        callId: callId,
        hasExistingFiles: !!(callFiles && callFiles.length > 0),
        filesCount: callFiles?.length || 0,
        isLoadingFiles: isLoadingFiles,
        hasError: !!errorFiles,
      });
    }
  }, [isOpen, trackEvent, callId, callFiles, isLoadingFiles, errorFiles]);

  // Handle sheet changes
  const handleSheetChanges = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  // Render backdrop
  const renderBackdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />, []);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Download and open file
  const handleDownloadFile = async (file: CallFileResultData) => {
    if (!file.Url || downloadingFiles[file.Id]) return;

    try {
      setDownloadingFiles((prev) => ({ ...prev, [file.Id]: 0 }));

      const fileData = await getCallAttachmentFile(file.Url, {
        onEvent: (event) => {
          if (event.type === 'progress' && event.progress !== undefined) {
            setDownloadingFiles((prev) => ({ ...prev, [file.Id]: event.progress! }));
          }
        },
      });

      // Create a temporary file
      const fileName = file.FileName || file.Name || `file_${file.Id}`;

      if (Platform.OS === 'web') {
        const objectUrl = URL.createObjectURL(fileData);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);

        setDownloadingFiles((prev) => {
          const newState = { ...prev };
          delete newState[file.Id];
          return newState;
        });
        return;
      }

      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Convert blob to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix if present
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(fileData);
      });

      // Write file to device
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Share/open the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: file.Mime || 'application/octet-stream',
          dialogTitle: file.Name || file.FileName,
        });
      } else {
        Alert.alert(t('calls.files.share_error'), 'Sharing is not available on this device');
      }

      setDownloadingFiles((prev) => {
        const newState = { ...prev };
        delete newState[file.Id];
        return newState;
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      Alert.alert(t('calls.files.open_error'), error instanceof Error ? error.message : 'Unknown error occurred');
      setDownloadingFiles((prev) => {
        const newState = { ...prev };
        delete newState[file.Id];
        return newState;
      });
    }
  };

  // Render individual file item
  const renderFileItem = (file: CallFileResultData) => {
    const isDownloading = downloadingFiles[file.Id] !== undefined;
    const downloadProgress = downloadingFiles[file.Id] || 0;

    return (
      <Pressable
        key={file.Id}
        onPress={() => handleDownloadFile(file)}
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
        style={{ opacity: isDownloading ? 0.7 : 1 }}
        testID={`file-item-${file.Id}`}
      >
        <HStack space="md" className="items-center">
          <File size={24} color="#6B7280" />
          <VStack className="flex-1" space="xs">
            <Text className="font-medium text-gray-900 dark:text-gray-100" numberOfLines={1}>
              {file.Name || file.FileName || t('calls.files.file_name')}
            </Text>
            <HStack space="md" className="items-center">
              <Text className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(file.Size)}</Text>
              {file.Timestamp && <Text className="text-sm text-gray-500 dark:text-gray-400">{formatDate(file.Timestamp)}</Text>}
            </HStack>
          </VStack>
          <Box className="items-center justify-center">
            {isDownloading ? (
              <VStack className="items-center" space="xs">
                <Spinner size="small" />
                <Text className="text-xs text-gray-500">{Math.round(downloadProgress)}%</Text>
              </VStack>
            ) : (
              <Download size={20} color="#6B7280" />
            )}
          </Box>
        </HStack>
      </Pressable>
    );
  };

  // Render files list content
  const renderFilesContent = () => {
    if (isLoadingFiles) {
      return (
        <Box className="flex-1 items-center justify-center py-8">
          <Spinner size="large" />
          <Text className="mt-4 text-gray-600 dark:text-gray-400">{t('common.loading')}</Text>
        </Box>
      );
    }

    if (errorFiles) {
      return (
        <Box className="flex-1 items-center justify-center py-8">
          <Text className="text-center text-red-600 dark:text-red-400">{t('calls.files.error')}</Text>
          <Text className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">{errorFiles}</Text>
          <Button variant="outline" onPress={() => fetchCallFiles(callId)} className="mt-4" size="sm">
            <Text>{t('common.retry')}</Text>
          </Button>
        </Box>
      );
    }

    if (!callFiles || callFiles.length === 0) {
      return (
        <Box className="flex-1 items-center justify-center py-8">
          <File size={48} color="#9CA3AF" />
          <Text className="mt-4 text-gray-600 dark:text-gray-400">{t('calls.files.no_files')}</Text>
          <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-500">{t('calls.files.no_files_description')}</Text>
        </Box>
      );
    }

    return (
      <VStack space="md" className="w-full">
        {callFiles.map(renderFileItem)}
      </VStack>
    );
  };

  return (
    <>
      <FocusAwareStatusBar hidden={true} />
      <BottomSheet
        ref={bottomSheetRef}
        index={isOpen ? 0 : -1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        enablePanDownToClose={true}
        handleIndicatorStyle={{ backgroundColor: '#D1D5DB' }}
        backgroundStyle={{ backgroundColor: 'white' }}
      >
        <BottomSheetView style={{ flex: 1 }} testID="call-files-modal">
          {/* Fixed Header */}
          <VStack space="md" className="bg-white dark:bg-gray-800">
            <Box className="w-full flex-row items-center justify-between border-b border-gray-200 px-4 pb-4 pt-2 dark:border-gray-700">
              <Heading size="lg">{t('calls.files.title')}</Heading>
              <Button variant="link" onPress={onClose} className="p-1" testID="close-button">
                <X size={24} />
              </Button>
            </Box>
          </VStack>

          {/* Scrollable Files List */}
          <ScrollView style={{ flex: 1 }} className="bg-white dark:bg-gray-800" showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
            {renderFilesContent()}
          </ScrollView>
        </BottomSheetView>
      </BottomSheet>
    </>
  );
};

export default CallFilesModal;
