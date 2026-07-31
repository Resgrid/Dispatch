import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, ImageIcon, PlusIcon, XIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Dimensions, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { FlatList } from '@/components/ui/flat-list';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAuthStore } from '@/lib';
import { type CallFileResultData } from '@/models/v4/callFiles/callFileResultData';
import { useLocationStore } from '@/stores/app/location-store';
import { useCallDetailStore } from '@/stores/calls/detail-store';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper, ActionsheetItem, ActionsheetItemText } from '../ui/actionsheet';
import { Box } from '../ui/box';
import { Button, ButtonIcon, ButtonText } from '../ui/button';
import { HStack } from '../ui/hstack';
import { Input, InputField } from '../ui/input';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';
import FullScreenImageModal from './full-screen-image-modal';

interface CallImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId: string;
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  galleryImage: {
    height: 256, // h-64 equivalent
    width: '100%',
    borderRadius: 8, // rounded-lg equivalent
  },
  previewImage: {
    height: 256, // h-64 equivalent
    width: '100%',
    borderRadius: 8, // rounded-lg equivalent
  },
});

const CallImagesModal: React.FC<CallImagesModalProps> = ({ isOpen, onClose, callId }) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { latitude, longitude } = useLocationStore();

  const [activeIndex, setActiveIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [newImageNote, setNewImageNote] = useState('');
  const [selectedImageInfo, setSelectedImageInfo] = useState<{ uri: string; filename: string } | null>(null);
  const [isAddingImage, setIsAddingImage] = useState(false);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [fullScreenImage, setFullScreenImage] = useState<{ source: any; name?: string } | null>(null);
  const flatListRef = useRef<any>(null); // FlashList ref type

  const { callImages, isLoadingImages, errorImages, fetchCallImages, uploadCallImage } = useCallDetailStore();

  // Filter out images without proper data or URL
  const validImages = useMemo(() => {
    if (!callImages) return [];

    const filtered = callImages.filter((image: CallFileResultData) => {
      const hasValidData = image.Data && image.Data.trim() !== '';
      const hasValidUrl = image.Url && image.Url.trim() !== '';
      return hasValidData || hasValidUrl;
    });

    return filtered;
  }, [callImages]);

  useEffect(() => {
    if (isOpen && callId) {
      fetchCallImages(callId);
      setActiveIndex(0); // Reset active index when opening
      setImageErrors(new Set()); // Reset image errors
    }
  }, [isOpen, callId, fetchCallImages]);

  // Track when call images modal is opened/rendered
  useEffect(() => {
    if (isOpen) {
      trackEvent('call_images_modal_opened', {
        callId: callId,
        hasExistingImages: validImages.length > 0,
        imagesCount: validImages.length,
        isLoadingImages: isLoadingImages,
        hasError: !!errorImages,
      });
    }
  }, [isOpen, trackEvent, callId, validImages.length, isLoadingImages, errorImages]);

  // Reset active index when valid images change
  useEffect(() => {
    if (activeIndex >= validImages.length && validImages.length > 0) {
      setActiveIndex(0);
    }
  }, [validImages.length, activeIndex]);

  const handleImageSelect = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      alert(t('common.permission_denied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const filename = asset.fileName || `image_${Date.now()}.png`;
      setSelectedImageInfo({ uri: asset.uri, filename });
    }
  };

  const handleCameraCapture = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      alert(t('common.permission_denied'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const filename = `camera_${Date.now()}.png`;
      setSelectedImageInfo({ uri: asset.uri, filename });
    }
  };

  const handleUploadImage = async () => {
    if (!selectedImageInfo) return;

    setIsUploading(true);
    try {
      // Manipulate image to ensure PNG format and proper compression
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        selectedImageInfo.uri,
        [{ resize: { width: 1024 } }], // Resize to max width of 1024px while maintaining aspect ratio
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.PNG, // Ensure PNG format
        }
      );

      // Read the manipulated image as base64
      const base64Image = await FileSystem.readAsStringAsync(manipulatedImage.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Get current location if available
      const currentLatitude = latitude;
      const currentLongitude = longitude;

      await uploadCallImage(
        callId,
        useAuthStore.getState().userId!,
        newImageNote || '', // Use note for the note field
        selectedImageInfo.filename, // Use filename for the name field
        currentLatitude, // Current latitude
        currentLongitude, // Current longitude
        base64Image
      );
      setSelectedImageInfo(null);
      setNewImageNote('');
      setIsAddingImage(false);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageError = (itemId: string, error: any) => {
    console.error(`Image failed to load for ${itemId}:`, error);
    setImageErrors((prev) => new Set([...prev, itemId]));
  };

  // Reset active index when valid images change

  const renderImageItem = ({ item, index }: { item: CallFileResultData; index: number }) => {
    if (!item) return null;

    const hasError = imageErrors.has(item.Id);
    let imageSource: { uri: string } | null = null;

    if (item.Data && item.Data.trim() !== '') {
      // Use Data as base64 image
      const mimeType = item.Mime || 'image/png'; // Default to png if no mime type
      imageSource = { uri: `data:${mimeType};base64,${item.Data}` };
    } else if (item.Url && item.Url.trim() !== '') {
      // Use URL directly since it's unauthenticated
      const url = item.Url.trim();
      imageSource = { uri: url };
    }

    // Show error state if there's an error or no valid image source
    if (!imageSource || hasError) {
      return (
        <Box className="w-full items-center justify-center px-4" style={{ width }}>
          <Box className="h-64 w-full items-center justify-center rounded-lg bg-gray-200">
            <ImageIcon size={48} color="#999" />
            <Text className="mt-2 text-gray-500">{t('callImages.failed_to_load')}</Text>
            {item.Url && (
              <Text className="mt-1 px-2 text-center text-xs text-gray-400" numberOfLines={2}>
                URL: {item.Url}
              </Text>
            )}
          </Box>
          <Text className="mt-2 text-center font-medium">{item.Name || ''}</Text>
          <Text className="text-xs text-gray-500">{item.Timestamp || ''}</Text>
        </Box>
      );
    }

    // At this point, imageSource is guaranteed to be non-null
    return (
      <Box className="w-full items-center justify-center px-4" style={{ width }}>
        <TouchableOpacity
          onPress={() => {
            setFullScreenImage({ source: imageSource, name: item.Name });
          }}
          testID={`image-${item.Id}-touchable`}
          activeOpacity={0.7}
          style={{ width: '100%' }}
          delayPressIn={0}
          delayPressOut={0}
        >
          <Image
            key={`${item.Id}-${index}`}
            source={imageSource}
            style={styles.galleryImage}
            contentFit="contain"
            transition={200}
            pointerEvents="none"
            onError={() => {
              handleImageError(item.Id, 'expo-image load error');
            }}
            onLoad={() => {
              // Remove from error set if it loads successfully
              setImageErrors((prev) => {
                const newSet = new Set(prev);
                newSet.delete(item.Id);
                return newSet;
              });
            }}
          />
        </TouchableOpacity>
        <Text className="mt-2 text-center font-medium">{item.Name || ''}</Text>
        <Text className="text-xs text-gray-500">{item.Timestamp || ''}</Text>
      </Box>
    );
  };

  const handleViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  const handlePrevious = () => {
    const newIndex = Math.max(0, activeIndex - 1);
    setActiveIndex(newIndex);
    try {
      flatListRef.current?.scrollToIndex({
        index: newIndex,
        animated: true,
      });
    } catch (error) {
      console.warn('Error scrolling to previous image:', error);
    }
  };

  const handleNext = () => {
    const newIndex = Math.min(validImages.length - 1, activeIndex + 1);
    setActiveIndex(newIndex);
    try {
      flatListRef.current?.scrollToIndex({
        index: newIndex,
        animated: true,
      });
    } catch (error) {
      console.warn('Error scrolling to next image:', error);
    }
  };

  const renderPagination = () => {
    if (!validImages || validImages.length <= 1) return null;

    return (
      <HStack className="mt-4 items-center justify-between px-4">
        <TouchableOpacity testID="previous-button" onPress={handlePrevious} disabled={activeIndex === 0} className={`rounded-full bg-white/80 p-2 ${activeIndex === 0 ? 'opacity-50' : ''}`}>
          <ChevronLeftIcon size={24} color="#000" />
        </TouchableOpacity>

        <HStack className="items-center space-x-2 rounded-full bg-white/80 px-4 py-2 dark:bg-gray-800/80">
          <Text className="text-sm font-medium text-gray-800 dark:text-white">
            {activeIndex + 1} / {validImages.length}
          </Text>
        </HStack>

        <TouchableOpacity
          testID="next-button"
          onPress={handleNext}
          disabled={activeIndex === validImages.length - 1}
          className={`rounded-full bg-white/80 p-2 ${activeIndex === validImages.length - 1 ? 'opacity-50' : ''}`}
        >
          <ChevronRightIcon size={24} color="#000" />
        </TouchableOpacity>
      </HStack>
    );
  };

  const renderAddImageContent = () => (
    <VStack className="flex-1">
      {/* Scrollable content area */}
      <VStack className="flex-1 space-y-4 p-4">
        <HStack className="items-center justify-between">
          <Text className="text-lg font-bold">{t('callImages.add_new')}</Text>
          <TouchableOpacity
            onPress={() => {
              setIsAddingImage(false);
              setSelectedImageInfo(null);
              setNewImageNote('');
            }}
          >
            <XIcon size={24} />
          </TouchableOpacity>
        </HStack>

        {selectedImageInfo ? (
          <Box className="flex-1 items-center justify-center">
            <Image source={{ uri: selectedImageInfo.uri }} style={styles.previewImage} contentFit="contain" transition={200} />
          </Box>
        ) : (
          <VStack className="flex-1 justify-center space-y-4">
            <ActionsheetItem onPress={handleImageSelect}>
              <HStack className="items-center space-x-2">
                <PlusIcon size={20} />
                <ActionsheetItemText>{t('callImages.select_from_gallery')}</ActionsheetItemText>
              </HStack>
            </ActionsheetItem>
            <ActionsheetItem onPress={handleCameraCapture}>
              <HStack className="items-center space-x-2">
                <CameraIcon size={20} />
                <ActionsheetItemText>{t('callImages.take_photo')}</ActionsheetItemText>
              </HStack>
            </ActionsheetItem>
          </VStack>
        )}
      </VStack>

      {/* Fixed bottom section for input and save button */}
      {selectedImageInfo && (
        <KeyboardAwareScrollView keyboardShouldPersistTaps={Platform.OS === 'android' ? 'handled' : 'always'} showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
          <VStack className="max-h-30 space-y-2 border-t border-gray-200 bg-white px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
            <Input className="w-full" size="sm">
              <InputField placeholder={t('callImages.image_note')} value={newImageNote} onChangeText={setNewImageNote} testID="image-note-input" />
            </Input>
            <Button className="mt-2 w-full" size="sm" onPress={handleUploadImage} isDisabled={isUploading} testID="upload-button">
              <ButtonText>{isUploading ? t('common.uploading') : t('callImages.upload')}</ButtonText>
            </Button>
          </VStack>
        </KeyboardAwareScrollView>
      )}
    </VStack>
  );

  const renderImageGallery = () => {
    if (!validImages?.length) return null;

    return (
      <VStack className="space-y-4 p-4">
        <Box className="relative">
          <FlatList
            ref={flatListRef}
            data={validImages}
            renderItem={renderImageItem}
            keyExtractor={(item, index) => item?.Id || item?.Url || `image-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={handleViewableItemsChanged}
            viewabilityConfig={{
              itemVisiblePercentThreshold: 50,
              minimumViewTime: 100,
            }}
            className="w-full"
            contentContainerStyle={{ paddingHorizontal: 0 }}
            initialScrollIndex={0}
            ListEmptyComponent={() => (
              <Box className="w-full items-center justify-center p-4">
                <Text className="text-center text-gray-500">{t('callImages.no_images')}</Text>
              </Box>
            )}
          />
        </Box>
        {renderPagination()}
      </VStack>
    );
  };

  const renderContent = () => {
    if (isLoadingImages) {
      return <Loading text={t('callImages.loading')} />;
    }

    if (errorImages) {
      return <ZeroState heading={t('callImages.error')} description={errorImages} isError={true} />;
    }

    if (isAddingImage) {
      return renderAddImageContent();
    }

    if (!validImages || validImages.length === 0) {
      return <ZeroState icon={ImageIcon} heading={t('callImages.no_images')} description={t('callImages.no_images_description')} />;
    }

    return renderImageGallery();
  };

  return (
    <>
      <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[67]}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="rounded-t-3x bg-white dark:bg-gray-800">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <Box className="w-full p-4">
            <HStack className="mb-4 items-center justify-between">
              <Text className="text-xl font-bold">{t('callImages.title')}</Text>
              {!isAddingImage && !isLoadingImages && (
                <Button size="sm" variant="outline" onPress={() => setIsAddingImage(true)}>
                  <ButtonIcon as={PlusIcon} />
                  <ButtonText>{t('callImages.add')}</ButtonText>
                </Button>
              )}
            </HStack>

            <View className="min-h-[300px]">{renderContent()}</View>
          </Box>
        </ActionsheetContent>
      </Actionsheet>

      {/* Full Screen Image Modal */}
      <FullScreenImageModal isOpen={!!fullScreenImage} onClose={() => setFullScreenImage(null)} imageSource={fullScreenImage?.source || { uri: '' }} imageName={fullScreenImage?.name} />
    </>
  );
};

export default CallImagesModal;
