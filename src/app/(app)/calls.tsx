import { useFocusEffect } from '@react-navigation/native';
import { type Href, router } from 'expo-router';
import { PlusIcon, RefreshCcwDotIcon, Search, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, View } from 'react-native';

import { CallCard } from '@/components/calls/call-card';
import { Loading } from '@/components/common/loading';
import ZeroState from '@/components/common/zero-state';
import { Box } from '@/components/ui/box';
import { Fab, FabIcon } from '@/components/ui/fab';
import { FlatList } from '@/components/ui/flat-list';
import { FocusAwareStatusBar } from '@/components/ui/focus-aware-status-bar';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { useAnalytics } from '@/hooks/use-analytics';
import { CallState } from '@/lib/utils';
import { type CallResultData } from '@/models/v4/calls/callResultData';
import { useCallsStore } from '@/stores/calls/store';
import { securityStore } from '@/stores/security/store';

export default function Calls() {
  // Field selectors only - subscribing to the whole store re-renders this screen on
  // every store change (e.g. SignalR timestamp updates)
  const calls = useCallsStore((s) => s.calls);
  const isLoading = useCallsStore((s) => s.isLoading);
  const error = useCallsStore((s) => s.error);
  const callPriorities = useCallsStore((s) => s.callPriorities);
  const fetchCalls = useCallsStore((s) => s.fetchCalls);
  const fetchCallPriorities = useCallsStore((s) => s.fetchCallPriorities);
  const canUserCreateCalls = securityStore((s) => s.rights?.CanCreateCalls);
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchCallPriorities();
      fetchCalls();

      return () => {
        // Clean up if needed when screen loses focus
      };
    }, [fetchCalls, fetchCallPriorities])
  );

  // Track when calls view is rendered
  useEffect(() => {
    trackEvent('calls_view_rendered', {
      callsCount: calls.length,
      hasSearchQuery: searchQuery.length > 0,
    });
  }, [trackEvent, calls.length, searchQuery]);

  const handleRefresh = () => {
    fetchCalls();
    fetchCallPriorities();
  };

  const handleNewCall = () => {
    router.push('/call/new/' as Href);
  };

  // Filter calls: exclude scheduled calls and apply search
  const filteredCalls = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return calls.filter((call) => call.State !== CallState.SCHEDULED).filter((call) => call.CallId.toLowerCase().includes(query) || (call.Nature?.toLowerCase() || '').includes(query));
  }, [calls, searchQuery]);

  // O(1) priority lookup per row instead of an O(n) find inside renderItem
  const priorityById = useMemo(() => {
    const map = new Map<number, (typeof callPriorities)[number]>();
    callPriorities.forEach((p) => map.set(p.Id, p));
    return map;
  }, [callPriorities]);

  const renderCallItem = useCallback(
    ({ item }: { item: CallResultData }) => (
      <Pressable onPress={() => router.push(`/call/${item.CallId}` as Href)}>
        <CallCard call={item} priority={priorityById.get(item.Priority)} />
      </Pressable>
    ),
    [priorityById]
  );

  // Render content based on loading, error, and data states
  const renderContent = () => {
    if (isLoading) {
      return <Loading text={t('calls.loading')} />;
    }

    if (error) {
      return <ZeroState heading={t('common.errorOccurred')} description={error} isError={true} />;
    }

    return (
      <FlatList<CallResultData>
        testID="calls-list"
        data={filteredCalls}
        renderItem={renderCallItem}
        keyExtractor={(item: CallResultData) => item.CallId}
        refreshControl={<RefreshControl refreshing={false} onRefresh={handleRefresh} />}
        ListEmptyComponent={<ZeroState heading={t('calls.no_calls')} description={t('calls.no_calls_description')} icon={RefreshCcwDotIcon} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    );
  };

  return (
    <View className="size-full flex-1 bg-gray-50 dark:bg-gray-900">
      <FocusAwareStatusBar />
      <Box className="flex-1 px-4 pt-4">
        {/* Search input */}
        <Input className="mb-4 rounded-lg bg-white dark:bg-gray-800" size="md" variant="outline">
          <InputSlot className="pl-3">
            <InputIcon as={Search} />
          </InputSlot>
          <InputField placeholder={t('calls.search')} value={searchQuery} onChangeText={setSearchQuery} />
          {searchQuery ? (
            <InputSlot className="pr-3" onPress={() => setSearchQuery('')}>
              <InputIcon as={X} />
            </InputSlot>
          ) : null}
        </Input>

        {/* Main content */}
        <Box className="flex-1">{renderContent()}</Box>

        {/* FAB button for creating new call - only show if user has permission */}
        {canUserCreateCalls ? (
          <Fab placement="bottom right" size="lg" onPress={handleNewCall} testID="new-call-fab">
            <FabIcon as={PlusIcon} size="lg" />
          </Fab>
        ) : null}
      </Box>
    </View>
  );
}
