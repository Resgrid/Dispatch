import { useNotifications } from '@novu/react-native';
import { ArrowLeft, Calendar, ExternalLink, Trash2 } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Animated, Appearance, Dimensions, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';

// Define the interface directly in this file
interface NotificationPayload {
  id: string;
  title?: string;
  body: string;
  createdAt: string;
  read?: boolean;
  type?: string;
  referenceId?: string;
  referenceType?: string;
  metadata?: Record<string, any>;
}

interface NotificationDetailProps {
  notification: NotificationPayload;
  onClose: () => void;
  onDelete: (id: string) => void;
  onNavigateToReference: (referenceType: string, referenceId: string) => void;
}

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(width * 0.85, 400);
const STATUS_BAR_HEIGHT = Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 0;

export const NotificationDetail = ({ notification, onClose, onDelete, onNavigateToReference }: NotificationDetailProps) => {
  const { refetch } = useNotifications();
  const slideAnim = React.useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Mark as read when opened - we'll just refetch to sync with server
    if (!notification.read && notification.id) {
      refetch();
    }

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
  }, [notification, refetch, slideAnim, fadeAnim]);

  const handleClose = () => {
    // Animate out
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
    ]).start(() => {
      onClose();
    });
  };

  const handleDelete = () => {
    onDelete(notification.id);
    handleClose();
  };

  const handleNavigateToReference = () => {
    if (notification.referenceType && notification.referenceId) {
      onNavigateToReference(notification.referenceType, notification.referenceId);
      handleClose();
    }
  };

  // Format the date for display
  const formattedDate = new Date(notification.createdAt).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = new Date(notification.createdAt).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdropPressable} onPress={handleClose} />
      </Animated.View>

      <Animated.View style={[styles.sidebarContainer, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.backButton}>
              <ArrowLeft size={24} className="text-primary-500 dark:text-primary-400" strokeWidth={2} />
            </Pressable>
            <Text style={styles.headerTitle}>Notification</Text>
            <Pressable onPress={handleDelete} style={styles.deleteButton}>
              <Trash2 size={24} className="text-red-500 dark:text-red-400" strokeWidth={2} />
            </Pressable>
          </View>

          <View style={styles.content}>
            <View style={styles.metadataContainer}>
              <View style={styles.dateContainer}>
                <Calendar size={16} className="text-gray-500 dark:text-gray-400" strokeWidth={2} />
                <Text style={styles.dateText}>{formattedDate}</Text>
              </View>
              <Text style={styles.timeText}>{formattedTime}</Text>
            </View>

            {notification.type ? (
              <View style={[styles.typeTag, getTypeTagStyle(notification.type)]}>
                <Text style={styles.typeTagText}>{notification.type}</Text>
              </View>
            ) : null}

            {notification.title ? <Text style={styles.title}>{notification.title}</Text> : null}

            <View style={styles.bodyContainer}>
              <Text style={styles.body}>{notification.body}</Text>
            </View>

            {notification.metadata && Object.keys(notification.metadata).length > 0 ? (
              <View style={styles.metadataDetailsContainer}>
                <Text style={styles.metadataTitle}>Additional Information</Text>
                {Object.entries(notification.metadata).map(([key, value]) => (
                  <View key={key} style={styles.metadataItem}>
                    <Text style={styles.metadataKey}>{formatKey(key)}:</Text>
                    <Text style={styles.metadataValue}>{formatValue(value)}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {notification.referenceType && notification.referenceId ? (
              <Pressable onPress={handleNavigateToReference} style={styles.referenceButton}>
                <ExternalLink size={18} style={styles.referenceButtonIcon} />
                <Text style={styles.buttonText}>View {notification.referenceType}</Text>
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
};

// Helper function to format metadata keys for display
const formatKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1') // Insert a space before all capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize the first letter
    .trim();
};

// Helper function to format metadata values for display
const formatValue = (value: any): string => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Helper function to get tag style based on notification type
const getTypeTagStyle = (type: string): any => {
  const lowerType = type.toLowerCase();

  if (lowerType.includes('alert') || lowerType.includes('emergency')) {
    return styles.typeTagAlert;
  } else if (lowerType.includes('warning')) {
    return styles.typeTagWarning;
  } else if (lowerType.includes('info')) {
    return styles.typeTagInfo;
  } else if (lowerType.includes('success')) {
    return styles.typeTagSuccess;
  } else {
    return styles.typeTagDefault;
  }
};

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
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
    zIndex: 10000,
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
    borderBottomColor: Appearance.getColorScheme() === 'dark' ? '#333333' : '#e5e5e5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    color: Appearance.getColorScheme() === 'dark' ? '#f3f4f6' : '#111827',
  },
  backButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  metadataContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    color: Appearance.getColorScheme() === 'dark' ? '#9ca3af' : '#6b7280',
    marginLeft: 6,
  },
  timeText: {
    fontSize: 14,
    color: Appearance.getColorScheme() === 'dark' ? '#9ca3af' : '#6b7280',
  },
  typeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 16,
  },
  typeTagText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  typeTagDefault: {
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#374151' : '#e5e7eb',
  },
  typeTagInfo: {
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#1e40af' : '#dbeafe',
  },
  typeTagSuccess: {
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#065f46' : '#d1fae5',
  },
  typeTagWarning: {
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#92400e' : '#fef3c7',
  },
  typeTagAlert: {
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#991b1b' : '#fee2e2',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: Appearance.getColorScheme() === 'dark' ? '#f3f4f6' : '#111827',
  },
  bodyContainer: {
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#262626' : '#f9fafb',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: Appearance.getColorScheme() === 'dark' ? '#e5e5e5' : '#374151',
  },
  metadataDetailsContainer: {
    marginTop: 10,
    padding: 16,
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#262626' : '#f9fafb',
    borderRadius: 8,
  },
  metadataTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: Appearance.getColorScheme() === 'dark' ? '#f3f4f6' : '#111827',
  },
  metadataItem: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  metadataKey: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 8,
    color: Appearance.getColorScheme() === 'dark' ? '#9ca3af' : '#6b7280',
  },
  metadataValue: {
    fontSize: 14,
    flex: 1,
    color: Appearance.getColorScheme() === 'dark' ? '#e5e5e5' : '#111827',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Appearance.getColorScheme() === 'dark' ? '#3b82f6' : '#2563eb',
  },
  referenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    backgroundColor: Appearance.getColorScheme() === 'dark' ? '#1e3a8a' : '#dbeafe',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Appearance.getColorScheme() === 'dark' ? '#3b82f6' : '#60a5fa',
  },
  referenceButtonIcon: {
    marginRight: 8,
    color: Appearance.getColorScheme() === 'dark' ? '#3b82f6' : '#2563eb',
  },
});
