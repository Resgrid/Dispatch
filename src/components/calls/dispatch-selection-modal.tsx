import { CheckIcon, SearchIcon, UsersIcon, X } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TouchableOpacity } from 'react-native';

import { Loading } from '@/components/common/loading';
import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField } from '@/components/ui/input';
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

  return (
    <Actionsheet isOpen={isVisible} onClose={handleCancel} snapPoints={[80]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="w-full bg-white dark:bg-gray-900">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        {/* Header */}
        <HStack className="w-full items-center justify-between border-b border-gray-200 p-2 pb-3 dark:border-gray-700">
          <HStack className="flex-1 items-center">
            <UsersIcon size={22} color={colorScheme === 'dark' ? '#d1d5db' : '#374151'} />
            <Text className="pl-3 text-lg font-bold" numberOfLines={1}>
              {t('calls.select_dispatch_recipients')}
            </Text>
          </HStack>
          <TouchableOpacity onPress={handleCancel} className="p-1">
            <X size={22} color={colorScheme === 'dark' ? '#9ca3af' : '#6b7280'} />
          </TouchableOpacity>
        </HStack>

        {/* Search */}
        <Box className="w-full px-2 py-3">
          <Input>
            <SearchIcon size={20} className="ml-3 mr-2 text-neutral-500" />
            <InputField placeholder={t('common.search')} value={searchQuery} onChangeText={setSearchQuery} className="flex-1" />
          </Input>
        </Box>

        {/* Content */}
        {isLoading ? (
          <Box className="w-full flex-1 items-center justify-center">
            <Loading />
          </Box>
        ) : error ? (
          <Box className="w-full flex-1 items-center justify-center p-4">
            <Text className="text-center text-red-500">{error}</Text>
            <Button variant="outline" className="mt-4" onPress={() => fetchDispatchData(true)}>
              <ButtonText>{t('common.retry')}</ButtonText>
            </Button>
          </Box>
        ) : (
          <ScrollView className="w-full flex-1 px-2" keyboardShouldPersistTaps="handled">
            {/* Partial load warning — the sections that did load are still usable. */}
            {hasLoadFailure && (
              <Card className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
                <HStack className="items-center justify-between gap-3">
                  <Text className="flex-1 text-sm text-amber-700">{t('calls.dispatch_recipients_partial_load')}</Text>
                  <TouchableOpacity onPress={() => fetchDispatchData(true)}>
                    <Text className="text-sm font-semibold text-blue-500">{t('common.retry')}</Text>
                  </TouchableOpacity>
                </HStack>
              </Card>
            )}

            {/* Everyone Option */}
            <Card className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
              <TouchableOpacity onPress={toggleEveryone}>
                <HStack className="items-center gap-3">
                  <Box className={`size-6 items-center justify-center rounded border-2 ${selection.everyone ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {selection.everyone ? <CheckIcon size={16} color="#ffffff" /> : null}
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
                  <Card key={`user-${user.Id}`} className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <TouchableOpacity onPress={() => toggleUser(user.Id)}>
                      <HStack className="items-center gap-3">
                        <Box className={`size-5 items-center justify-center rounded border-2 ${selection.users.includes(user.Id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                          {selection.users.includes(user.Id) ? <CheckIcon size={12} color="#ffffff" /> : null}
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
                  <Card key={`group-${group.Id}`} className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <TouchableOpacity onPress={() => toggleGroup(group.Id)}>
                      <HStack className="items-center gap-3">
                        <Box className={`size-5 items-center justify-center rounded border-2 ${selection.groups.includes(group.Id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                          {selection.groups.includes(group.Id) ? <CheckIcon size={12} color="#ffffff" /> : null}
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
                  <Card key={`role-${role.Id}`} className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <TouchableOpacity onPress={() => toggleRole(role.Id)}>
                      <HStack className="items-center gap-3">
                        <Box className={`size-5 items-center justify-center rounded border-2 ${selection.roles.includes(role.Id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                          {selection.roles.includes(role.Id) ? <CheckIcon size={12} color="#ffffff" /> : null}
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
                  <Card key={`unit-${unit.Id}`} className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                    <TouchableOpacity onPress={() => toggleUnit(unit.Id)}>
                      <HStack className="items-center gap-3">
                        <Box className={`size-5 items-center justify-center rounded border-2 ${selection.units.includes(unit.Id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-600'}`}>
                          {selection.units.includes(unit.Id) ? <CheckIcon size={12} color="#ffffff" /> : null}
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
        <Box className="w-full border-t border-gray-200 p-4 dark:border-gray-700">
          <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
            {getSelectionCount()} {t('calls.selected')}
          </Text>
          <HStack space="sm" className="w-full">
            <Button variant="outline" onPress={handleCancel} className="flex-1">
              <ButtonText>{t('common.cancel')}</ButtonText>
            </Button>
            <Button variant="solid" action="primary" onPress={handleConfirm} disabled={getSelectionCount() === 0} className="flex-1">
              <ButtonText>{t('common.confirm')}</ButtonText>
            </Button>
          </HStack>
        </Box>
      </ActionsheetContent>
    </Actionsheet>
  );
};
