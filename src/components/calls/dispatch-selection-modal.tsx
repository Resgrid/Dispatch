import { CheckIcon, SearchIcon, UsersIcon, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, TouchableOpacity, View } from 'react-native';

import { Loading } from '@/components/common/loading';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { type DispatchSelection, useDispatchStore } from '@/stores/dispatch/store';

interface DispatchSelectionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (selection: DispatchSelection) => void;
  initialSelection?: DispatchSelection;
}

export const DispatchSelectionModal: React.FC<DispatchSelectionModalProps> = ({ isVisible, onClose, onConfirm, initialSelection }) => {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const {
    data,
    selection,
    isLoading,
    error,
    loadFailures,
    searchQuery,
    fetchDispatchData,
    setSelection,
    toggleEveryone,
    toggleUser,
    toggleGroup,
    toggleRole,
    toggleUnit,
    setSearchQuery,
    clearSelection,
    getFilteredData,
  } = useDispatchStore();

  const hasLoadFailure = loadFailures.users || loadFailures.groups || loadFailures.units;

  const filteredData = useMemo(() => getFilteredData(), [getFilteredData]);

  useEffect(() => {
    if (isVisible) {
      fetchDispatchData();
      if (initialSelection) {
        setSelection(initialSelection);
      }
    }
  }, [isVisible, initialSelection, fetchDispatchData, setSelection]);

  const handleConfirm = () => {
    onConfirm(selection);
    onClose();
  };

  const handleCancel = () => {
    clearSelection();
    onClose();
  };

  const getSelectionCount = () => {
    if (selection.everyone) return 1;
    return selection.users.length + selection.groups.length + selection.roles.length + selection.units.length;
  };

  if (!isVisible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        backgroundColor: colorScheme === 'dark' ? '#000000' : '#ffffff',
      }}
    >
      {/* Header */}
      <Box className={`flex-row items-center justify-between p-4 ${colorScheme === 'dark' ? 'border-b border-neutral-800 bg-neutral-900' : 'border-b border-neutral-200 bg-white'}`}>
        <HStack className="items-center gap-3">
          <UsersIcon size={24} className={colorScheme === 'dark' ? 'text-white' : 'text-neutral-900'} />
          <Text className="pl-4 text-xl font-bold">{t('calls.select_dispatch_recipients')}</Text>
        </HStack>
        <TouchableOpacity onPress={handleCancel}>
          <X size={24} className={colorScheme === 'dark' ? 'text-white' : 'text-neutral-900'} />
        </TouchableOpacity>
      </Box>

      {/* Search */}
      <Box className="p-4">
        <HStack className={`items-center rounded border px-3 ${colorScheme === 'dark' ? 'border-neutral-700 bg-neutral-900' : 'border-neutral-300 bg-white'}`}>
          <SearchIcon size={20} color={colorScheme === 'dark' ? '#a3a3a3' : '#737373'} />
          <TextInput
            placeholder={t('common.search')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={{
              flex: 1,
              height: 40,
              marginLeft: 8,
              color: colorScheme === 'dark' ? '#ffffff' : '#000000',
            }}
            placeholderTextColor={colorScheme === 'dark' ? '#737373' : '#a3a3a3'}
          />
        </HStack>
      </Box>

      {/* Content */}
      {isLoading ? (
        <Loading />
      ) : error ? (
        <Box className="flex-1 items-center justify-center p-4">
          <Text className="text-center text-red-500">{error}</Text>
        </Box>
      ) : (
        <ScrollView className="flex-1 px-4">
          {/* Partial load warning — the sections that did load are still usable. */}
          {hasLoadFailure && (
            <Card className={`mb-4 rounded-lg border p-3 ${colorScheme === 'dark' ? 'border-amber-700 bg-amber-950' : 'border-amber-300 bg-amber-50'}`}>
              <HStack className="items-center justify-between gap-3">
                <Text className="flex-1 text-sm text-amber-700">{t('calls.dispatch_recipients_partial_load')}</Text>
                <TouchableOpacity onPress={() => fetchDispatchData(true)}>
                  <Text className="text-sm font-semibold text-blue-500">{t('common.retry')}</Text>
                </TouchableOpacity>
              </HStack>
            </Card>
          )}

          {/* Everyone Option */}
          <Card className={`mb-4 rounded-lg border p-4 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
            <TouchableOpacity onPress={toggleEveryone}>
              <HStack className="items-center gap-3">
                <Box className={`size-6 items-center justify-center rounded border-2 ${selection.everyone ? 'border-blue-500 bg-blue-500' : colorScheme === 'dark' ? 'border-neutral-600' : 'border-neutral-300'}`}>
                  {selection.everyone && <CheckIcon size={16} className="text-white" />}
                </Box>
                <VStack className="flex-1">
                  <Text className="pl-4 text-lg font-semibold">{t('calls.everyone')}</Text>
                  <Text className="pl-4 text-sm text-neutral-500">{t('calls.dispatch_to_everyone')}</Text>
                </VStack>
              </HStack>
            </TouchableOpacity>
          </Card>

          {/* Users Section */}
          {filteredData.users.length > 0 && (
            <VStack className="mb-6">
              <Text className="mb-3 text-lg font-semibold">
                {t('calls.users')} ({filteredData.users.length})
              </Text>
              {filteredData.users.map((user) => (
                <Card key={`user-${user.Id}`} className={`mb-2 rounded-lg border p-3 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
                  <TouchableOpacity onPress={() => toggleUser(user.Id)}>
                    <HStack className="items-center gap-3">
                      <Box
                        className={`size-5 items-center justify-center rounded border-2 ${
                          selection.users.includes(user.Id) ? 'border-blue-500 bg-blue-500' : colorScheme === 'dark' ? 'border-neutral-600' : 'border-neutral-300'
                        }`}
                      >
                        {selection.users.includes(user.Id) && <CheckIcon size={12} className="text-white" />}
                      </Box>
                      <VStack className="flex-1">
                        <Text className="pl-4 font-medium">{user.Name}</Text>
                      </VStack>
                    </HStack>
                  </TouchableOpacity>
                </Card>
              ))}
            </VStack>
          )}

          {/* Groups Section */}
          {filteredData.groups.length > 0 && (
            <VStack className="mb-6">
              <Text className="mb-3 text-lg font-semibold">
                {t('calls.groups')} ({filteredData.groups.length})
              </Text>
              {filteredData.groups.map((group) => (
                <Card key={`group-${group.Id}`} className={`mb-2 rounded-lg border p-3 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
                  <TouchableOpacity onPress={() => toggleGroup(group.Id)}>
                    <HStack className="items-center gap-3">
                      <Box
                        className={`size-5 items-center justify-center rounded border-2 ${
                          selection.groups.includes(group.Id) ? 'border-blue-500 bg-blue-500' : colorScheme === 'dark' ? 'border-neutral-600' : 'border-neutral-300'
                        }`}
                      >
                        {selection.groups.includes(group.Id) && <CheckIcon size={12} className="text-white" />}
                      </Box>
                      <VStack className="flex-1">
                        <Text className="pl-4 font-medium">{group.Name}</Text>
                      </VStack>
                    </HStack>
                  </TouchableOpacity>
                </Card>
              ))}
            </VStack>
          )}

          {/* Roles Section */}
          {filteredData.roles.length > 0 && (
            <VStack className="mb-6">
              <Text className="mb-3 text-lg font-semibold">
                {t('calls.roles')} ({filteredData.roles.length})
              </Text>
              {filteredData.roles.map((role) => (
                <Card key={`role-${role.Id}`} className={`mb-2 rounded-lg border p-3 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
                  <TouchableOpacity onPress={() => toggleRole(role.Id)}>
                    <HStack className="items-center gap-3">
                      <Box
                        className={`size-5 items-center justify-center rounded border-2 ${
                          selection.roles.includes(role.Id) ? 'border-blue-500 bg-blue-500' : colorScheme === 'dark' ? 'border-neutral-600' : 'border-neutral-300'
                        }`}
                      >
                        {selection.roles.includes(role.Id) && <CheckIcon size={12} className="text-white" />}
                      </Box>
                      <VStack className="flex-1">
                        <Text className="pl-4 font-medium">{role.Name}</Text>
                      </VStack>
                    </HStack>
                  </TouchableOpacity>
                </Card>
              ))}
            </VStack>
          )}

          {/* Units Section */}
          {filteredData.units.length > 0 && (
            <VStack className="mb-6">
              <Text className="mb-3 text-lg font-semibold">
                {t('calls.units')} ({filteredData.units.length})
              </Text>
              {filteredData.units.map((unit) => (
                <Card key={`unit-${unit.Id}`} className={`mb-2 rounded-lg border p-3 ${colorScheme === 'dark' ? 'border-neutral-800 bg-neutral-900' : 'border-neutral-200 bg-white'}`}>
                  <TouchableOpacity onPress={() => toggleUnit(unit.Id)}>
                    <HStack className="items-center gap-3">
                      <Box
                        className={`size-5 items-center justify-center rounded border-2 ${
                          selection.units.includes(unit.Id) ? 'border-blue-500 bg-blue-500' : colorScheme === 'dark' ? 'border-neutral-600' : 'border-neutral-300'
                        }`}
                      >
                        {selection.units.includes(unit.Id) && <CheckIcon size={12} className="text-white" />}
                      </Box>
                      <VStack className="flex-1">
                        <Text className="pl-4 font-medium">{unit.Name}</Text>
                      </VStack>
                    </HStack>
                  </TouchableOpacity>
                </Card>
              ))}
            </VStack>
          )}

          {/* No Results */}
          {searchQuery && filteredData.users.length === 0 && filteredData.groups.length === 0 && filteredData.roles.length === 0 && filteredData.units.length === 0 && (
            <Box className="items-center justify-center py-8">
              <Text className="text-center text-neutral-500">{t('common.no_results_found')}</Text>
            </Box>
          )}

          {/* Everything loaded and there is genuinely nothing to pick beyond Everyone. Say so, rather
              than leaving the dispatcher staring at a single option wondering what broke. */}
          {!searchQuery && !hasLoadFailure && data.users.length === 0 && data.groups.length === 0 && data.roles.length === 0 && data.units.length === 0 && (
            <Box className="items-center justify-center px-4 py-8">
              <Text className="text-center text-neutral-500">{t('calls.dispatch_recipients_empty')}</Text>
            </Box>
          )}
        </ScrollView>
      )}

      {/* Footer */}
      <Box className={`flex-row items-center justify-between p-4 ${colorScheme === 'dark' ? 'border-t border-neutral-800 bg-neutral-900' : 'border-t border-neutral-200 bg-white'}`}>
        <Text className="text-sm text-neutral-500">
          {getSelectionCount()} {t('calls.selected')}
        </Text>
        <HStack className="gap-3 pl-4">
          <Button variant="outline" onPress={handleCancel} className="mr-10 flex-1">
            <ButtonText>{t('common.cancel')}</ButtonText>
          </Button>
          <Button variant="solid" action="primary" onPress={handleConfirm} disabled={getSelectionCount() === 0} className="ml-2 flex-1">
            <ButtonText>{t('common.confirm')}</ButtonText>
          </Button>
        </HStack>
      </Box>
    </View>
  );
};
