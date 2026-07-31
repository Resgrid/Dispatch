import { useNotifications } from '@novu/react-native';
import { CheckCircle, ChevronRight, Circle, ExternalLink, MoreVertical, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Appearance, Dimensions, Platform, Pressable, RefreshControl, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

import { deleteMessage } from '@/api/novu/inbox';
import { NotificationDetail } from '@/components/notifications/NotificationDetail';
import { Button } from '@/components/ui/button';
import { FlatList } from '@/components/ui/flat-list';
import { Modal, ModalBackdrop, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/modal';
import { Text } from '@/components/ui/text';
import { useCoreStore } from '@/stores/app/core-store';
import { useToastStore } from '@/stores/toast/store';
import { type NotificationPayload } from '@/types/notification';

// Constants
const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(width * 0.85, 400);
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

interface NotificationInboxProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationInbox = ({ isOpen, onClose }: NotificationInboxProps) => {
  const activeUnitId = useCoreStore((state) => state.activeUnitId);
  const config = useCoreStore((state: any) => state.config);
  const { notifications, isLoading, fetchMore, hasMore, refetch } = useNotifications();
  const showToast = useToastStore((state) => state.showToast);
  const [selectedNotification, setSelectedNotification] = useState<NotificationPayload | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  // Animation values
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isOpen) {
      // Animate in
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out and reset state
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SIDEBAR_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Reset selection state when closing
      setIsSelectionMode(false);
      setSelectedNotificationIds(new Set());
      setSelectedNotification(null);
      setShowDeleteConfirmModal(false);
    }
  }, [isOpen, slideAnim, fadeAnim]);

  const handleNotificationPress = (notification: NotificationPayload) => {
    if (isSelectionMode) {
      toggleNotificationSelection(notification.id);
    } else {
      setSelectedNotification(notification);
    }
  };

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotificationIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const enterSelectionMode = () => {
    setIsSelectionMode(true);
    setSelectedNotificationIds(new Set());
  };

  const exitSelectionMode = React.useCallback(() => {
    setIsSelectionMode(false);
    setSelectedNotificationIds(new Set());
  }, []);

  const selectAllNotifications = () => {
    const allIds = notifications?.map((item: any) => item.id) || [];
    setSelectedNotificationIds(new Set(allIds));
  };

  const deselectAllNotifications = () => {
    setSelectedNotificationIds(new Set());
  };

  const handleBulkDelete = () => {
    if (selectedNotificationIds.size > 0) {
      setShowDeleteConfirmModal(true);
    }
  };

  const confirmBulkDelete = React.useCallback(async () => {
    setIsDeletingSelected(true);
    setShowDeleteConfirmModal(false);

    try {
      const deletePromises = Array.from(selectedNotificationIds).map((id) => deleteMessage(id));
      await Promise.all(deletePromises);

      showToast('success', `${selectedNotificationIds.size} notification${selectedNotificationIds.size > 1 ? 's' : ''} removed`);
      exitSelectionMode();
      refetch();
    } catch (error) {
      showToast('error', 'Failed to remove notifications');
    } finally {
      setIsDeletingSelected(false);
    }
  }, [selectedNotificationIds, showToast, exitSelectionMode, refetch]);

  const handleDeleteNotification = React.useCallback(
    async (_id: string) => {
      try {
        await deleteMessage(_id);
        showToast('success', 'Notification removed');
        refetch();
      } catch (error) {
        showToast('error', 'Failed to remove notification');
      }
    },
    [showToast, refetch]
  );

  const handleNavigateToReference = (referenceType: string, referenceId: string) => {
    // TODO: Implement navigation based on reference type
    console.log('Navigate to:', referenceType, referenceId);
    onClose();
  };

  const renderItem = ({ item }: { item: any }) => {
    const notification: NotificationPayload = {
      id: item.id,
      title: item.title,
      body: item.body,
      createdAt: item.createdAt,
      read: item.read,
      type: item.type,
      referenceId: item.payload?.referenceId,
      referenceType: item.payload?.referenceType,
      metadata: item.payload?.metadata,
    };

    const isSelected = selectedNotificationIds.has(notification.id);

    return (
      <Pressable
        onPress={() => handleNotificationPress(notification)}
        onLongPress={() => {
          if (!isSelectionMode) {
            enterSelectionMode();
            toggleNotificationSelection(notification.id);
          }
        }}
        style={[styles.notificationItem, !item.read ? styles.unreadNotificationItem : {}, isSelected ? styles.selectedNotificationItem : {}]}
      >
        {!item.read ? <View style={styles.unreadIndicator} /> : null}

        {isSelectionMode ? (
          <View style={styles.selectionIndicator}>
            {isSelected ? <CheckCircle size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} /> : <Circle size={24} className="text-gray-400 dark:text-gray-500" strokeWidth={2} />}
          </View>
        ) : null}

        <View style={styles.notificationContent}>
          <Text style={[styles.notificationBody, !item.read ? styles.unreadNotificationText : {}]}>{notification.body}</Text>
          <Text style={styles.timestamp}>
            {new Date(notification.createdAt).toLocaleDateString()} {new Date(notification.createdAt).toLocaleTimeString()}
          </Text>
        </View>

        {!isSelectionMode ? (
          notification.referenceType && notification.referenceId ? (
            <View style={styles.actionButtons}>
              <Button onPress={() => handleNavigateToReference(notification.referenceType!, notification.referenceId!)} variant="outline" className="size-8 p-0">
                <ExternalLink size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
              </Button>
              <ChevronRight size={24} className="ml-2 text-gray-400" strokeWidth={2} />
            </View>
          ) : (
            <ChevronRight size={24} className="ml-2 text-gray-400" strokeWidth={2} />
          )
        ) : null}
      </Pressable>
    );
  };

  const renderFooter = () => {
    if (!hasMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#2196F3" />
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text>No updates available</Text>
    </View>
  );

  if (!isOpen) {
    return null;
  }

  // Additional safety check to prevent rendering overlay without proper config
  if (!activeUnitId || !config || !config.NovuApplicationId || !config.NovuBackendApiUrl || !config.NovuSocketUrl) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop for tapping outside to close */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />
      </Animated.View>

      {/* Sidebar container */}
      <Animated.View style={[styles.sidebarContainer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.safeArea}>
          {selectedNotification ? (
            <NotificationDetail notification={selectedNotification} onClose={() => setSelectedNotification(null)} onDelete={handleDeleteNotification} onNavigateToReference={handleNavigateToReference} />
          ) : (
            <>
              <View style={styles.header}>
                {isSelectionMode ? (
                  <>
                    <View style={styles.selectionHeader}>
                      <Text style={styles.selectionCount}>{selectedNotificationIds.size} selected</Text>
                      <View style={styles.selectionActions}>
                        <Button onPress={selectedNotificationIds.size === notifications?.length ? deselectAllNotifications : selectAllNotifications} variant="outline" className="mr-2">
                          <Text>{selectedNotificationIds.size === notifications?.length ? 'Deselect All' : 'Select All'}</Text>
                        </Button>
                        <Button onPress={handleBulkDelete} variant="outline" className="mr-2" disabled={selectedNotificationIds.size === 0 || isDeletingSelected}>
                          {isDeletingSelected ? <ActivityIndicator size="small" color="#ef4444" /> : <Trash2 size={16} className="text-red-500" strokeWidth={2} />}
                        </Button>
                        <Button onPress={exitSelectionMode} variant="outline">
                          <Text>Cancel</Text>
                        </Button>
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    <View style={styles.headerActions}>
                      <Pressable onPress={enterSelectionMode} style={styles.actionButton}>
                        <MoreVertical size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
                      </Pressable>
                      <Pressable onPress={onClose} style={styles.closeButton}>
                        <X size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
                      </Pressable>
                    </View>
                  </>
                )}
              </View>

              {isLoading && !notifications ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                </View>
              ) : !activeUnitId || !config ? (
                <View style={styles.loadingContainer}>
                  <Text>Unable to load notifications</Text>
                </View>
              ) : (
                <FlatList
                  testID="notifications-list"
                  data={notifications}
                  renderItem={renderItem}
                  keyExtractor={(item) => item.id}
                  onEndReached={fetchMore}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={renderFooter}
                  ListEmptyComponent={renderEmpty}
                  refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} colors={['#2196F3']} />}
                />
              )}
            </>
          )}
        </SafeAreaView>
      </Animated.View>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirmModal} onClose={() => setShowDeleteConfirmModal(false)} {...({} as any)}>
        <ModalBackdrop />
        <ModalContent>
          <ModalHeader>
            <Text className="text-lg font-semibold">Confirm Delete</Text>
          </ModalHeader>
          <ModalBody>
            <Text>
              Are you sure you want to delete {selectedNotificationIds.size} notification{selectedNotificationIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onPress={() => setShowDeleteConfirmModal(false)} className="mr-2">
              <Text>Cancel</Text>
            </Button>
            <Button variant="solid" onPress={confirmBulkDelete} className="bg-red-500">
              <Text className="text-white">Delete</Text>
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  backdropPressable: {
    width: '100%',
    height: '100%',
  },
  sidebarContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#171717' : '#fff',
    shadowColor: Appearance.getColorScheme() === 'dark' ? '#262626' : '#e5e5e5',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'android' ? STATUS_BAR_HEIGHT + 16 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginRight: 8,
  },
  closeButton: {
    padding: 8,
  },
  selectionHeader: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
    color: Appearance.getColorScheme() === 'dark' ? '#ffffff' : '#000000',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Appearance.getColorScheme() === 'dark' ? '#333333' : '#eee',
    position: 'relative',
  },
  unreadNotificationItem: {
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#262626' : '#f0f7ff',
  },
  selectedNotificationItem: {
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#1e3a8a' : '#dbeafe',
  },
  unreadIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 4,
    height: '100%',
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#60a5fa' : '#3b82f6',
  },
  selectionIndicator: {
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationBody: {
    fontSize: 16,
    marginBottom: 4,
    color: Appearance.getColorScheme() === 'dark' ? '#e5e5e5' : '#333333',
  },
  unreadNotificationText: {
    fontWeight: '600',
    color: Appearance.getColorScheme() === 'dark' ? '#ffffff' : '#000000',
  },
  timestamp: {
    fontSize: 12,
    color: Appearance.getColorScheme() === 'dark' ? '#a3a3a3' : '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
});
