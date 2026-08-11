import { type Href, useRouter } from 'expo-router';
import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardListIcon,
  ClockIcon,
  MapPinIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  NetworkIcon,
  PlusIcon,
  RadioIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  TimerIcon,
  UserCogIcon,
  UserPlusIcon,
  XIcon,
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';

import { Box } from '@/components/ui/box';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useDirectMessage } from '@/hooks/use-direct-message';
import { ChatChannelType } from '@/models/v4/chat';
import { type CommandStructureNode } from '@/models/v4/incidentCommand/commandStructureNode';
import { hasIncidentCapability, IncidentCapabilities, IncidentCommandStatus, ResourceAssignmentKind } from '@/models/v4/incidentCommand/incidentCommandEnums';
import { useChatStore } from '@/stores/chat/store';
import { useIncidentCommandStore } from '@/stores/incident-command/store';
import { usePersonnelStore } from '@/stores/personnel/store';
import { useToastStore } from '@/stores/toast/store';
import { useUnitsStore } from '@/stores/units/store';

import { CommandVoice } from './command-voice';
import { accountabilityColorClass, isObjectiveComplete, logEntryTypeLabel, nodeTypeLabel, objectiveTypeLabel, resourceKindLabel, roleTypeLabel, timerStatusLabel, timerTypeLabel } from './ic-labels';
import { ActionPlanSheet, AddLaneSheet, AddObjectiveSheet, AssignResourceSheet, AssignRoleSheet, MoveNodeSheet, MoveResourceSheet, TransferCommandSheet } from './incident-command-sheets';

type SheetKey = 'actionPlan' | 'objective' | 'lane' | 'resource' | 'role' | 'transfer' | null;

const formatDate = (value?: string | null): string => (value ? new Date(value).toLocaleString() : '');

/** A titled card section with an optional header action button. */
const Section: React.FC<{ title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, action, children }) => (
  <Box className="mb-3 rounded-lg bg-background-50 p-3">
    <HStack className="mb-2 items-center justify-between">
      <HStack className="items-center space-x-2">
        {icon}
        <Heading size="sm">{title}</Heading>
      </HStack>
      {action}
    </HStack>
    {children}
  </Box>
);

/** One tappable channel row; shows as unavailable rather than hiding, so absence is explainable. */
const ChatChannelRow: React.FC<{
  label: string;
  hint?: string;
  icon: React.ReactNode;
  channelId: string | null;
  unavailableMessage: string;
  onOpen: (channelId: string | null, unavailableMessage: string) => void;
  openLabel: string;
  testID?: string;
}> = ({ label, hint, icon, channelId, unavailableMessage, onOpen, openLabel, testID }) => (
  <HStack className="items-center justify-between border-b border-outline-100 pb-1 pt-1" testID={testID}>
    <HStack className="min-w-0 flex-1 items-center space-x-2">
      {icon}
      <VStack className="min-w-0 flex-1">
        <Text className={`text-sm ${channelId ? 'font-medium' : 'text-gray-500'}`}>{label}</Text>
        {hint ? <Text className="text-xs text-gray-500">{hint}</Text> : null}
      </VStack>
    </HStack>
    <Button variant="link" size="xs" onPress={() => onOpen(channelId, unavailableMessage)} isDisabled={!channelId}>
      <ButtonText className="text-xs">{channelId ? openLabel : '—'}</ButtonText>
    </Button>
  </HStack>
);

type TranslateFn = ReturnType<typeof useTranslation>['t'];

const confirmAction = (message: string, onConfirm: () => void, t: TranslateFn) => {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (typeof window !== 'undefined' && window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('', message, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.ok'), style: 'destructive', onPress: onConfirm },
  ]);
};

export const CommandBoardView: React.FC = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const showToast = useToastStore((s) => s.showToast);
  const board = useIncidentCommandStore((s) => s.board);
  const timeline = useIncidentCommandStore((s) => s.timeline);
  const capabilities = useIncidentCommandStore((s) => s.capabilities);
  const personnel = usePersonnelStore((s) => s.personnel);
  const units = useUnitsStore((s) => s.units);
  const [sheet, setSheet] = useState<SheetKey>(null);
  const [moveNodeId, setMoveNodeId] = useState<string | null>(null);
  const [moveAssignmentId, setMoveAssignmentId] = useState<string | null>(null);

  // Capability-derived gating (capabilities is a reactive selector, so these recompute on change).
  const canManageCommand = hasIncidentCapability(capabilities, IncidentCapabilities.ManageCommand);
  const canManageStructure = hasIncidentCapability(capabilities, IncidentCapabilities.ManageStructure);
  const canAssignResources = hasIncidentCapability(capabilities, IncidentCapabilities.AssignResources);
  const canManageObjectives = hasIncidentCapability(capabilities, IncidentCapabilities.ManageObjectives);
  const canManageTimers = hasIncidentCapability(capabilities, IncidentCapabilities.ManageTimers);
  const canManageAccountability = hasIncidentCapability(capabilities, IncidentCapabilities.ManageAccountability);
  const canManageAnnotations = hasIncidentCapability(capabilities, IncidentCapabilities.ManageAnnotations);
  const canManageChannels = hasIncidentCapability(capabilities, IncidentCapabilities.ManageChannels);

  const { openDirectMessage } = useDirectMessage();
  const incidentChannels = useChatStore((s) => (board?.Command?.CallId ? s.incidentChannelsByCallId[String(board.Command.CallId)] : undefined));

  const personnelMap = useMemo(() => new Map(personnel.map((p) => [p.UserId, `${p.FirstName} ${p.LastName}`.trim()])), [personnel]);
  const unitsMap = useMemo(() => new Map(units.map((u) => [u.UnitId, u.Name])), [units]);

  if (!board || !board.Command) return null;
  const command = board.Command;
  const isClosed = command.Status === IncidentCommandStatus.Closed;

  const resourceName = (kind: number, id: string): string => {
    if (kind === ResourceAssignmentKind.RealUnit) return unitsMap.get(id) ?? id;
    if (kind === ResourceAssignmentKind.RealPersonnel) return personnelMap.get(id) ?? id;
    return id;
  };
  const userName = (id: string): string => personnelMap.get(id) || id || t('incident_command.unassigned');

  // Channel ids come from the server already filtered to what this user may open — an id we did not
  // receive is one the API would reject, so the row renders as unavailable rather than a dead link.
  const findChannel = (channelType: number): string | null => incidentChannels?.find((channel) => channel.ChannelType === channelType)?.ChatChannelId ?? null;
  const dispatchChannelId = findChannel(ChatChannelType.IncidentDispatch);
  const incidentChannelId = findChannel(ChatChannelType.Incident);

  const openChannel = (channelId: string | null, unavailableMessage: string) => {
    if (!channelId) {
      showToast('info', unavailableMessage);
      return;
    }
    router.push({ pathname: '/chat/[channelId]', params: { channelId } });
  };

  const activeNodes = (board.Nodes ?? []).filter((node) => !node.DeletedOn);
  const activeAssignments = (board.Assignments ?? []).filter((a) => !a.ReleasedOn);
  const counts = useIncidentCommandStore.getState().accountabilityCounts();

  // Flatten the lane hierarchy (by ParentNodeId + SortOrder) into ordered rows with depth for rendering.
  const orderedLanes = (() => {
    const ids = new Set(activeNodes.map((n) => n.CommandStructureNodeId));
    const childrenOf = (parentId: string) => activeNodes.filter((n) => (n.ParentNodeId || '') === parentId).sort((a, b) => a.SortOrder - b.SortOrder);
    const roots = activeNodes.filter((n) => !n.ParentNodeId || !ids.has(n.ParentNodeId)).sort((a, b) => a.SortOrder - b.SortOrder);
    const rows: { node: CommandStructureNode; depth: number; index: number; count: number }[] = [];
    const walk = (list: CommandStructureNode[], depth: number) => {
      list.forEach((node, index) => {
        rows.push({ node, depth, index, count: list.length });
        walk(childrenOf(node.CommandStructureNodeId), depth + 1);
      });
    };
    walk(roots, 0);
    return rows;
  })();

  const runAction = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      showToast('success', t('incident_command.saved'));
    } catch {
      showToast('error', t('incident_command.save_error'));
    }
  };

  const handleCloseCommand = () => {
    confirmAction(
      t('incident_command.confirm_close'),
      () => {
        void runAction(() => useIncidentCommandStore.getState().closeCommand());
      },
      t
    );
  };

  return (
    <Box className="p-3">
      {/* Status header */}
      <Box className="mb-3 rounded-lg bg-background-50 p-3">
        <HStack className="items-center justify-between">
          <VStack>
            <Text className="text-xs uppercase text-gray-500">{t('incident_command.status')}</Text>
            <Text className={`text-base font-bold ${isClosed ? 'text-gray-500' : 'text-green-600 dark:text-green-400'}`}>{isClosed ? t('incident_command.closed') : t('incident_command.active')}</Text>
          </VStack>
          <VStack className="items-end">
            <Text className="text-xs uppercase text-gray-500">{t('incident_command.commander')}</Text>
            <Text className="font-medium">{userName(command.CurrentCommanderUserId)}</Text>
          </VStack>
        </HStack>
        <Text className="mt-2 text-xs text-gray-500">
          {t('incident_command.established_on')}: {formatDate(command.EstablishedOn)}
        </Text>
        {!isClosed && canManageCommand ? (
          <HStack className="mt-3 space-x-2">
            <Button variant="outline" size="sm" className="mr-2 flex-1" onPress={() => setSheet('transfer')}>
              <ButtonText className="text-xs">{t('incident_command.transfer_command')}</ButtonText>
            </Button>
            <Button variant="outline" size="sm" className="ml-2 flex-1 border-red-400" onPress={handleCloseCommand}>
              <ButtonText className="text-xs text-red-600 dark:text-red-400">{t('incident_command.close_command')}</ButtonText>
            </Button>
          </HStack>
        ) : null}
      </Box>

      {/* Action plan */}
      <Section
        title={t('incident_command.action_plan')}
        icon={<ClipboardListIcon size={16} />}
        action={
          !isClosed && canManageCommand ? (
            <Button variant="link" size="xs" onPress={() => setSheet('actionPlan')}>
              <ButtonText className="text-xs">{t('incident_command.edit')}</ButtonText>
            </Button>
          ) : undefined
        }
      >
        <Text className="text-sm">{command.IncidentActionPlan || t('incident_command.no_action_plan')}</Text>
      </Section>

      {/* Roles */}
      <Section
        title={t('incident_command.roles')}
        icon={<UserCogIcon size={16} />}
        action={
          !isClosed && canManageCommand ? (
            <Button variant="link" size="xs" onPress={() => setSheet('role')}>
              <ButtonIcon as={UserPlusIcon} size="xs" />
              <ButtonText className="text-xs">{t('incident_command.add')}</ButtonText>
            </Button>
          ) : undefined
        }
      >
        {(board.Roles ?? []).filter((r) => !r.RemovedOn).length === 0 ? (
          <Text className="text-sm text-gray-500">{t('incident_command.no_roles')}</Text>
        ) : (
          <VStack className="space-y-2">
            {(board.Roles ?? [])
              .filter((r) => !r.RemovedOn)
              .map((role) => (
                <HStack key={role.IncidentRoleAssignmentId} className="items-center justify-between border-b border-outline-100 pb-1">
                  <VStack>
                    <Text className="text-sm font-medium">{roleTypeLabel(role.RoleType)}</Text>
                    <Text className="text-xs text-gray-500">{userName(role.UserId)}</Text>
                  </VStack>
                  {!isClosed && canManageCommand ? (
                    <Button variant="link" size="xs" onPress={() => runAction(() => useIncidentCommandStore.getState().removeRole(role.IncidentRoleAssignmentId))}>
                      <ButtonIcon as={XIcon} size="xs" className="text-red-500" />
                    </Button>
                  ) : null}
                </HStack>
              ))}
          </VStack>
        )}
      </Section>

      {/* Structure (lanes + assignments) */}
      <Section
        title={t('incident_command.structure')}
        icon={<NetworkIcon size={16} />}
        action={
          !isClosed && canManageStructure ? (
            <Button variant="link" size="xs" onPress={() => setSheet('lane')}>
              <ButtonIcon as={PlusIcon} size="xs" />
              <ButtonText className="text-xs">{t('incident_command.add_lane')}</ButtonText>
            </Button>
          ) : undefined
        }
      >
        {orderedLanes.length === 0 ? (
          <Text className="text-sm text-gray-500">{t('incident_command.no_lanes')}</Text>
        ) : (
          <VStack className="space-y-2">
            {orderedLanes.map(({ node, depth, index, count }) => {
              const assignments = activeAssignments.filter((a) => a.CommandStructureNodeId === node.CommandStructureNodeId);
              return (
                <Box key={node.CommandStructureNodeId} className="rounded-md border border-outline-100 p-2" style={{ marginLeft: depth * 14 }}>
                  <HStack className="items-center justify-between">
                    <VStack className="flex-1">
                      <Text className="text-sm font-semibold">{node.Name}</Text>
                      <Text className="text-xs text-gray-500">{nodeTypeLabel(node.NodeType)}</Text>
                    </VStack>
                    {!isClosed && canManageStructure ? (
                      <HStack className="items-center">
                        <Button variant="link" size="xs" disabled={index === 0} onPress={() => runAction(() => useIncidentCommandStore.getState().reorderNode(node.CommandStructureNodeId, 'up'))}>
                          <ButtonIcon as={ChevronUpIcon} size="xs" />
                        </Button>
                        <Button variant="link" size="xs" disabled={index === count - 1} onPress={() => runAction(() => useIncidentCommandStore.getState().reorderNode(node.CommandStructureNodeId, 'down'))}>
                          <ButtonIcon as={ChevronDownIcon} size="xs" />
                        </Button>
                        <Button variant="link" size="xs" onPress={() => setMoveNodeId(node.CommandStructureNodeId)}>
                          <ButtonText className="text-xs">{t('incident_command.move')}</ButtonText>
                        </Button>
                        <Button variant="link" size="xs" onPress={() => runAction(() => useIncidentCommandStore.getState().deleteNode(node.CommandStructureNodeId))}>
                          <ButtonIcon as={XIcon} size="xs" className="text-red-500" />
                        </Button>
                      </HStack>
                    ) : null}
                  </HStack>
                  {assignments.length > 0 ? (
                    <VStack className="mt-1 space-y-1 pl-2">
                      {assignments.map((assignment) => (
                        <HStack key={assignment.ResourceAssignmentId} className="items-center justify-between">
                          <Text className="flex-1 text-xs">
                            {resourceName(assignment.ResourceKind, assignment.ResourceId)} <Text className="text-gray-400">({resourceKindLabel(assignment.ResourceKind)})</Text>
                          </Text>
                          {!isClosed && canAssignResources ? (
                            <HStack className="items-center">
                              <Button variant="link" size="xs" onPress={() => setMoveAssignmentId(assignment.ResourceAssignmentId)}>
                                <ButtonText className="text-xs">{t('incident_command.move')}</ButtonText>
                              </Button>
                              <Button variant="link" size="xs" onPress={() => runAction(() => useIncidentCommandStore.getState().releaseResource(assignment.ResourceAssignmentId))}>
                                <ButtonText className="text-xs text-red-500">{t('incident_command.release')}</ButtonText>
                              </Button>
                            </HStack>
                          ) : null}
                        </HStack>
                      ))}
                    </VStack>
                  ) : (
                    <Text className="mt-1 pl-2 text-xs text-gray-400">{t('incident_command.no_resources')}</Text>
                  )}
                </Box>
              );
            })}
          </VStack>
        )}
        {!isClosed && canAssignResources && activeNodes.length > 0 ? (
          <Button variant="outline" size="sm" className="mt-2" onPress={() => setSheet('resource')}>
            <ButtonIcon as={PlusIcon} size="xs" />
            <ButtonText className="text-xs">{t('incident_command.assign_resource')}</ButtonText>
          </Button>
        ) : null}
      </Section>

      {/* Objectives */}
      <Section
        title={t('incident_command.objectives')}
        icon={<CheckCircleIcon size={16} />}
        action={
          !isClosed && canManageObjectives ? (
            <Button variant="link" size="xs" onPress={() => setSheet('objective')}>
              <ButtonIcon as={PlusIcon} size="xs" />
              <ButtonText className="text-xs">{t('incident_command.add')}</ButtonText>
            </Button>
          ) : undefined
        }
      >
        {(board.Objectives ?? []).length === 0 ? (
          <Text className="text-sm text-gray-500">{t('incident_command.no_objectives')}</Text>
        ) : (
          <VStack className="space-y-2">
            {(board.Objectives ?? []).map((objective) => {
              const complete = isObjectiveComplete(objective.Status);
              return (
                <HStack key={objective.TacticalObjectiveId} className="items-center justify-between border-b border-outline-100 pb-1">
                  <VStack className="flex-1">
                    <Text className={`text-sm font-medium ${complete ? 'text-gray-400 line-through' : ''}`}>{objective.Name}</Text>
                    <Text className="text-xs text-gray-500">{objectiveTypeLabel(objective.ObjectiveType)}</Text>
                  </VStack>
                  {complete ? (
                    <Text className="text-xs font-medium text-green-600 dark:text-green-400">{t('incident_command.completed')}</Text>
                  ) : !isClosed && canManageObjectives ? (
                    <Button variant="link" size="xs" onPress={() => runAction(() => useIncidentCommandStore.getState().completeObjective(objective.TacticalObjectiveId))}>
                      <ButtonText className="text-xs">{t('incident_command.complete')}</ButtonText>
                    </Button>
                  ) : null}
                </HStack>
              );
            })}
          </VStack>
        )}
      </Section>

      {/* Timers */}
      <Section title={t('incident_command.timers')} icon={<TimerIcon size={16} />}>
        {(board.Timers ?? []).length === 0 ? (
          <Text className="text-sm text-gray-500">{t('incident_command.no_timers')}</Text>
        ) : (
          <VStack className="space-y-2">
            {(board.Timers ?? []).map((timer) => (
              <HStack key={timer.IncidentTimerId} className="items-center justify-between border-b border-outline-100 pb-1">
                <VStack className="flex-1">
                  <Text className="text-sm font-medium">{timer.Name || timerTypeLabel(timer.TimerType)}</Text>
                  <Text className="text-xs text-gray-500">
                    {timerStatusLabel(timer.Status)}
                    {timer.NextDueOn ? ` · ${t('incident_command.due')}: ${formatDate(timer.NextDueOn)}` : ''}
                  </Text>
                </VStack>
                {!isClosed && canManageTimers ? (
                  <Button variant="link" size="xs" onPress={() => runAction(() => useIncidentCommandStore.getState().acknowledgeTimer(timer.IncidentTimerId))}>
                    <ButtonText className="text-xs">{t('incident_command.acknowledge')}</ButtonText>
                  </Button>
                ) : null}
              </HStack>
            ))}
          </VStack>
        )}
      </Section>

      {/* Accountability (PAR) */}
      <Section
        title={t('incident_command.accountability')}
        icon={<ShieldAlertIcon size={16} />}
        action={
          !isClosed && canManageAccountability ? (
            <Button variant="link" size="xs" onPress={() => runAction(() => useIncidentCommandStore.getState().evaluateAccountability())}>
              <ButtonText className="text-xs">{t('incident_command.run_par')}</ButtonText>
            </Button>
          ) : undefined
        }
      >
        <HStack className="mb-2 space-x-4">
          <Text className="text-sm text-green-600 dark:text-green-400">
            {t('incident_command.green')}: {counts.green}
          </Text>
          <Text className="text-sm text-amber-600 dark:text-amber-400">
            {t('incident_command.warning')}: {counts.warning}
          </Text>
          <Text className="text-sm text-red-600 dark:text-red-400">
            {t('incident_command.critical')}: {counts.critical}
          </Text>
        </HStack>
        {(board.Accountability ?? []).length === 0 ? (
          <Text className="text-sm text-gray-500">{t('incident_command.no_accountability')}</Text>
        ) : (
          <VStack className="space-y-1">
            {(board.Accountability ?? []).map((person) => (
              <HStack key={person.UserId} className="items-center justify-between">
                <Text className="text-sm">{person.FullName || userName(person.UserId)}</Text>
                <Text className={`text-xs font-medium ${accountabilityColorClass(person.Status)}`}>{person.Status}</Text>
              </HStack>
            ))}
          </VStack>
        )}
      </Section>

      {/* Timeline */}
      <Section title={t('incident_command.timeline')} icon={<ClockIcon size={16} />}>
        {timeline.length === 0 ? (
          <Text className="text-sm text-gray-500">{t('incident_command.no_timeline')}</Text>
        ) : (
          <VStack className="space-y-2">
            {timeline.map((entry) => (
              <Box key={entry.CommandLogEntryId} className="border-l-4 border-blue-500 py-1 pl-3">
                <Text className="text-sm font-semibold">{logEntryTypeLabel(entry.EntryType)}</Text>
                {entry.Description ? <Text className="text-xs text-gray-600 dark:text-gray-300">{entry.Description}</Text> : null}
                <Text className="text-xs text-gray-500">{formatDate(entry.OccurredOn)}</Text>
              </Box>
            ))}
          </VStack>
        )}
      </Section>

      {/* Annotations / tactical map */}
      <Section
        title={t('incident_command.annotations')}
        icon={<MapPinIcon size={16} />}
        action={
          <Button variant="link" size="xs" onPress={() => router.push(`/call/${command.CallId}/tactical-map` as Href)}>
            <ButtonText className="text-xs">{t('incident_command.open_tactical_map')}</ButtonText>
          </Button>
        }
      >
        {(board.Annotations ?? []).filter((a) => !a.DeletedOn).length === 0 ? (
          <Text className="text-sm text-gray-500">{t('incident_command.no_annotations')}</Text>
        ) : (
          <VStack className="space-y-1">
            {(board.Annotations ?? [])
              .filter((a) => !a.DeletedOn)
              .map((annotation) => (
                <HStack key={annotation.IncidentMapAnnotationId} className="items-center justify-between border-b border-outline-100 pb-1">
                  <Text className="text-sm">{annotation.Label || t('incident_command.marker')}</Text>
                  {!isClosed && canManageAnnotations ? (
                    <Button variant="link" size="xs" onPress={() => runAction(() => useIncidentCommandStore.getState().deleteAnnotation(annotation.IncidentMapAnnotationId))}>
                      <ButtonIcon as={XIcon} size="xs" className="text-red-500" />
                    </Button>
                  ) : null}
                </HStack>
              ))}
          </VStack>
        )}
      </Section>

      {/* Incident chat: the channels this dispatcher can open, and a direct line to the IC. */}
      <Section title={t('incident_command.chat')} icon={<MessagesSquareIcon size={16} />}>
        {isClosed ? <Text className="mb-2 text-xs text-gray-500">{t('incident_command.chat_frozen')}</Text> : null}
        <VStack className="space-y-1">
          {/* The call's shared conversation — everyone working the incident, dispatch included. */}
          <ChatChannelRow
            label={t('incident_command.incident_channel')}
            hint={t('incident_command.incident_channel_hint')}
            icon={<MessagesSquareIcon size={16} className="text-blue-500" />}
            channelId={incidentChannelId}
            unavailableMessage={t('incident_command.incident_channel_unavailable')}
            onOpen={openChannel}
            openLabel={t('incident_command.open_chat')}
            testID="incident-command-chat-incident"
          />
          {/* The desk's own line to the incident. The private command channel is deliberately absent:
              it stays internal to command staff, and dispatch reaches command through here. */}
          <ChatChannelRow
            label={t('incident_command.dispatch_channel')}
            hint={t('incident_command.dispatch_channel_hint')}
            icon={<RadioIcon size={16} className="text-blue-500" />}
            channelId={dispatchChannelId}
            unavailableMessage={t('incident_command.dispatch_channel_unavailable')}
            onOpen={openChannel}
            openLabel={t('incident_command.open_chat')}
            testID="incident-command-chat-dispatch"
          />

          {/* Direct line to whoever currently holds command. */}
          {command.CurrentCommanderUserId ? (
            <HStack className="items-center justify-between border-b border-outline-100 pb-1 pt-1" testID="incident-command-chat-ic">
              <VStack className="min-w-0 flex-1">
                <Text className="text-sm font-medium">{userName(command.CurrentCommanderUserId)}</Text>
                <Text className="text-xs text-gray-500">{t('incident_command.commander')}</Text>
              </VStack>
              <Button variant="link" size="xs" onPress={() => void openDirectMessage(command.CurrentCommanderUserId)} testID="incident-command-chat-ic-message">
                <ButtonIcon as={MessageCircleIcon} size="xs" className="mr-1 text-blue-500" />
                <ButtonText className="text-xs">{t('incident_command.send_message')}</ButtonText>
              </Button>
            </HStack>
          ) : null}

          {/* Everyone holding an ICS position, so dispatch can reach the right person directly. */}
          {(board.Roles ?? [])
            .filter((role) => !role.RemovedOn)
            .map((role) => (
              <HStack key={role.IncidentRoleAssignmentId} className="items-center justify-between border-b border-outline-100 pb-1 pt-1">
                <VStack className="min-w-0 flex-1">
                  <Text className="text-sm font-medium">{userName(role.UserId)}</Text>
                  <Text className="text-xs text-gray-500">{roleTypeLabel(role.RoleType)}</Text>
                </VStack>
                <Button variant="link" size="xs" onPress={() => void openDirectMessage(role.UserId)}>
                  <ButtonIcon as={MessageCircleIcon} size="xs" className="mr-1 text-blue-500" />
                  <ButtonText className="text-xs">{t('incident_command.send_message')}</ButtonText>
                </Button>
              </HStack>
            ))}
        </VStack>
      </Section>

      {/* Voice channels */}
      <CommandVoice />

      {/* Sheets */}
      <ActionPlanSheet isOpen={sheet === 'actionPlan'} onClose={() => setSheet(null)} />
      <AddObjectiveSheet isOpen={sheet === 'objective'} onClose={() => setSheet(null)} />
      <AddLaneSheet isOpen={sheet === 'lane'} onClose={() => setSheet(null)} />
      <AssignResourceSheet isOpen={sheet === 'resource'} onClose={() => setSheet(null)} />
      <AssignRoleSheet isOpen={sheet === 'role'} onClose={() => setSheet(null)} />
      <TransferCommandSheet isOpen={sheet === 'transfer'} onClose={() => setSheet(null)} />
      <MoveNodeSheet nodeId={moveNodeId} onClose={() => setMoveNodeId(null)} />
      <MoveResourceSheet assignmentId={moveAssignmentId} onClose={() => setMoveAssignmentId(null)} />
    </Box>
  );
};
