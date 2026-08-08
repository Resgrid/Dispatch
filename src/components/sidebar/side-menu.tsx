import { type Href, useRouter } from 'expo-router';
import {
  CalendarClock,
  CloudLightning,
  Contact,
  FileText,
  Home,
  List,
  type LucideIcon,
  Map as MapIcon,
  MapPinned,
  MessageCircle,
  MessagesSquare,
  Network,
  Phone,
  Plus,
  Settings,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useIsChatEnabled } from '@/stores/feature-flags/store';

interface SideMenuProps {
  onNavigate?: () => void;
  colorScheme?: 'light' | 'dark';
}

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  route?: string;
  children?: MenuItem[];
}

const getMenuItems = (t: (key: string) => string): MenuItem[] => [
  { id: 'home', label: t('menu.home'), icon: Home, route: '/' },
  {
    id: 'calls',
    label: t('menu.calls'),
    icon: Phone,
    children: [
      { id: 'calls-list', label: t('menu.calls_list'), icon: List, route: '/calls' },
      { id: 'scheduled-calls', label: t('menu.scheduled_calls'), icon: CalendarClock, route: '/scheduled-calls' },
      { id: 'new-call', label: t('menu.new_call'), icon: Plus, route: '/call/new' },
      { id: 'incident-command', label: t('menu.incident_command'), icon: Network, route: '/incident-command' },
    ],
  },
  { id: 'pois', label: t('menu.pois'), icon: MapPinned, route: '/pois' },
  { id: 'map', label: t('menu.map'), icon: MapIcon, route: '/map' },
  { id: 'personnel', label: t('menu.personnel'), icon: Users, route: '/personnel' },
  { id: 'units', label: t('menu.units'), icon: Truck, route: '/units' },
  { id: 'weather-alerts', label: t('menu.weatherAlerts'), icon: CloudLightning, route: '/weather-alerts' },
  { id: 'protocols', label: t('menu.protocols'), icon: FileText, route: '/protocols' },
  { id: 'contacts', label: t('menu.contacts'), icon: Contact, route: '/contacts' },
  { id: 'chat', label: t('menu.chat'), icon: MessagesSquare, route: '/chat' },
  { id: 'assistant', label: t('menu.assistant'), icon: Sparkles, route: '/chatbot' },
  { id: 'settings', label: t('menu.settings'), icon: Settings, route: '/settings' },
];

// Color palette matching home page panels
const colors = {
  light: {
    background: '#f3f4f6', // gray-100
    headerBg: '#f9fafb', // gray-50 (matching panel headers)
    headerBorder: '#e5e7eb', // gray-200
    headerText: '#111827', // gray-900
    menuItemText: '#374151', // gray-700
    menuItemIcon: '#4b5563', // gray-600
    menuItemPressed: '#e5e7eb', // gray-200
    divider: '#e5e7eb', // gray-200
    chevron: '#6b7280', // gray-500
    childBg: '#ffffff', // white for child items
  },
  dark: {
    background: '#030712', // gray-950
    headerBg: '#1f2937', // gray-800 (matching panel headers)
    headerBorder: '#374151', // gray-700
    headerText: '#f9fafb', // gray-50
    menuItemText: '#d1d5db', // gray-300
    menuItemIcon: '#9ca3af', // gray-400
    menuItemPressed: '#374151', // gray-700
    divider: '#374151', // gray-700
    chevron: '#9ca3af', // gray-400
    childBg: '#111827', // gray-900 for child items
  },
};

function SideMenu({ onNavigate, colorScheme: propColorScheme }: SideMenuProps): React.JSX.Element {
  const router = useRouter();
  const { t } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const isChatEnabled = useIsChatEnabled();
  // Chat and the assistant are gated by the Chat.System feature flag.
  const menuItems = getMenuItems(t).filter((item) => (item.id === 'chat' || item.id === 'assistant' ? isChatEnabled : true));

  // Use prop if provided, otherwise default to light on web
  const isDark = propColorScheme === 'dark';
  const theme = isDark ? colors.dark : colors.light;

  const handleNavigation = (route: string) => {
    onNavigate?.();
    router.push(route as Href);
  };

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const renderMenuItem = (item: MenuItem, isChild = false) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);
    const IconComponent = item.icon;

    return (
      <React.Fragment key={item.id}>
        <Pressable
          onPress={() => {
            if (hasChildren) {
              toggleExpanded(item.id);
            } else if (item.route) {
              handleNavigation(item.route);
            }
          }}
          style={({ pressed }) => [styles.menuItem, isChild ? [styles.childMenuItem, { backgroundColor: theme.childBg }] : null, pressed ? { backgroundColor: theme.menuItemPressed } : null]}
        >
          <View style={styles.menuItemIcon}>
            <IconComponent size={isChild ? 18 : 20} color={theme.menuItemIcon} />
          </View>
          <Text style={[styles.menuItemText, { color: theme.menuItemText }, isChild ? styles.childMenuItemText : null]}>{item.label}</Text>
          {hasChildren ? <Text style={[styles.chevron, { color: theme.chevron }]}>{isExpanded ? '▼' : '▶'}</Text> : null}
        </Pressable>
        {hasChildren && isExpanded ? <View style={[styles.childrenContainer, { borderLeftColor: theme.divider }]}>{item.children?.map((child) => renderMenuItem(child, true))}</View> : null}
      </React.Fragment>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.headerBorder }]}>
        <Text style={[styles.headerText, { color: theme.headerText }]}>{t('menu.menu')}</Text>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} testID="side-menu-scroll-view">
        {menuItems.map((item, index) => (
          <React.Fragment key={item.id}>
            {renderMenuItem(item)}
            {index < menuItems.length - 1 ? <View style={[styles.divider, { backgroundColor: theme.divider }]} /> : null}
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  childMenuItem: {
    paddingLeft: 48,
    paddingVertical: 12,
  },
  childMenuItemText: {
    fontSize: 14,
  },
  menuItemIcon: {
    width: 24,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    marginLeft: 8,
  },
  childrenContainer: {
    borderLeftWidth: 2,
    marginLeft: 28,
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
});

export default SideMenu;
