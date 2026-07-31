import { AlertTriangle, Bluetooth, BluetoothConnected, CheckCircle, Mic, MicOff, RefreshCw, Signal, Wifi } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';

import { Actionsheet, ActionsheetBackdrop, ActionsheetContent, ActionsheetDragIndicator, ActionsheetDragIndicatorWrapper } from '@/components/ui/actionsheet';
import { Badge } from '@/components/ui/badge';
import { Box } from '@/components/ui/box';
import { Button, ButtonText } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { HStack } from '@/components/ui/hstack';
import { Spinner } from '@/components/ui/spinner';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { bluetoothAudioService } from '@/services/bluetooth-audio';
import { type BluetoothAudioDevice, State, useBluetoothAudioStore } from '@/stores/app/bluetooth-audio-store';
import { useLiveKitStore } from '@/stores/app/livekit-store';

interface BluetoothAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BluetoothAudioModal: React.FC<BluetoothAudioModalProps> = ({ isOpen, onClose }) => {
  const { bluetoothState, isScanning, isConnecting, availableDevices, connectedDevice, connectionError, isAudioRoutingActive, buttonEvents, lastButtonAction } = useBluetoothAudioStore();

  const { isConnected: isLiveKitConnected, currentRoom } = useLiveKitStore();
  const [isMicMuted, setIsMicMuted] = useState(false);

  const handleStartScan = React.useCallback(async () => {
    try {
      await bluetoothAudioService.startScanning(15000); // 15 second scan
    } catch (error) {
      console.error('Failed to start Bluetooth scan:', error);
    }
  }, []);

  useEffect(() => {
    // Update mic state from LiveKit
    if (currentRoom?.localParticipant) {
      setIsMicMuted(!currentRoom.localParticipant.isMicrophoneEnabled);
    }
  }, [currentRoom?.localParticipant, currentRoom?.localParticipant?.isMicrophoneEnabled]);

  useEffect(() => {
    // Auto-start scanning when modal opens and Bluetooth is ready
    if (isOpen && bluetoothState === State.PoweredOn && !isScanning && !connectedDevice) {
      handleStartScan().catch((error) => {
        console.error('Failed to start scan:', error);
      });
    }
  }, [isOpen, bluetoothState, isScanning, connectedDevice, handleStartScan]);

  useEffect(() => {
    // Stop scanning when the modal closes
    if (!isOpen && isScanning) {
      bluetoothAudioService.stopScanning();
    }
  }, [isOpen, isScanning]);

  useEffect(() => {
    return () => {
      if (useBluetoothAudioStore.getState().isScanning) {
        bluetoothAudioService.stopScanning();
      }
    };
  }, []);

  const handleStopScan = React.useCallback(() => {
    bluetoothAudioService.stopScanning();
  }, []);

  const handleConnectDevice = React.useCallback(
    async (device: BluetoothAudioDevice) => {
      if (isConnecting) return;

      try {
        await bluetoothAudioService.connectToDevice(device.id);
      } catch (error) {
        console.error('Failed to connect to device:', error);
      }
    },
    [isConnecting]
  );

  const handleDisconnectDevice = React.useCallback(async () => {
    try {
      await bluetoothAudioService.disconnectDevice();
    } catch (error) {
      console.error('Failed to disconnect device:', error);
    }
  }, []);

  const handleToggleMicrophone = React.useCallback(async () => {
    if (!currentRoom?.localParticipant) return;

    try {
      const newMuteState = !isMicMuted;
      await currentRoom.localParticipant.setMicrophoneEnabled(!newMuteState);
      setIsMicMuted(newMuteState);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
    }
  }, [currentRoom?.localParticipant, isMicMuted]);

  const renderBluetoothState = () => {
    switch (bluetoothState) {
      case State.PoweredOff:
        return (
          <VStack space="md" className="items-center p-4">
            <AlertTriangle size={48} color="orange" />
            <Text className="text-center">Bluetooth is turned off. Please enable Bluetooth to connect audio devices.</Text>
          </VStack>
        );
      case State.Unauthorized:
        return (
          <VStack space="md" className="items-center p-4">
            <AlertTriangle size={48} color="red" />
            <Text className="text-center">Bluetooth permission denied. Please grant Bluetooth permissions in Settings.</Text>
          </VStack>
        );
      case State.PoweredOn:
        return null;
      default:
        return (
          <VStack space="md" className="items-center p-4">
            <Spinner size="large" />
            <Text className="text-center">Checking Bluetooth status...</Text>
          </VStack>
        );
    }
  };

  const renderConnectionError = () => {
    if (!connectionError) return null;

    return (
      <Card className="mb-4 border-red-200 bg-red-50 p-4">
        <HStack space="sm" className="items-center">
          <AlertTriangle size={20} color="red" />
          <VStack className="flex-1">
            <Text className="font-medium text-red-700">Connection Error</Text>
            <Text className="text-sm text-red-600">{connectionError}</Text>
          </VStack>
        </HStack>
      </Card>
    );
  };

  const renderConnectedDevice = () => {
    if (!connectedDevice) return null;

    return (
      <Card className="mb-4 border-green-200 bg-green-50 p-4">
        <HStack space="md" className="items-center justify-between">
          <HStack space="sm" className="flex-1 items-center">
            <BluetoothConnected size={24} color="green" />
            <VStack className="flex-1">
              <Text className="font-medium text-green-700">{connectedDevice.name || 'Unknown Device'}</Text>
              <HStack space="xs" className="items-center">
                <Text className="text-sm text-green-600">Connected</Text>
                {isAudioRoutingActive ? (
                  <Badge variant="outline" className="ml-2">
                    <Text className="text-xs">Audio Active</Text>
                  </Badge>
                ) : null}
              </HStack>
              {connectedDevice.supportsMicrophoneControl ? <Text className="text-xs text-green-600">Button control available</Text> : null}
            </VStack>
          </HStack>

          <VStack space="xs" className="items-end">
            {isLiveKitConnected ? (
              <Button onPress={handleToggleMicrophone} variant="outline" size="sm">
                {isMicMuted ? <MicOff size={16} color="red" /> : <Mic size={16} color="green" />}
                <ButtonText className="ml-1">{isMicMuted ? 'Unmute' : 'Mute'}</ButtonText>
              </Button>
            ) : null}

            <Button onPress={handleDisconnectDevice} variant="outline" action="secondary" size="sm">
              <ButtonText>Disconnect</ButtonText>
            </Button>
          </VStack>
        </HStack>
      </Card>
    );
  };

  const renderRecentButtonEvents = () => {
    if (buttonEvents.length === 0) return null;

    const recentEvents = buttonEvents.slice(0, 3);

    return (
      <Card className="mb-4 p-4">
        <Heading size="sm" className="mb-2">
          Recent Button Events
        </Heading>
        <VStack space="xs">
          {recentEvents.map((event, index) => (
            <HStack key={`${event.timestamp}-${index}`} space="sm" className="items-center">
              <Text className="text-xs text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</Text>
              <Text className="text-sm">
                {event.type === 'long_press' ? 'Long ' : event.type === 'double_press' ? 'Double ' : ''}
                {event.button === 'ptt_start'
                  ? 'PTT Start'
                  : event.button === 'ptt_stop'
                    ? 'PTT Stop'
                    : event.button === 'mute'
                      ? 'Mute'
                      : event.button === 'volume_up'
                        ? 'Volume +'
                        : event.button === 'volume_down'
                          ? 'Volume -'
                          : 'Unknown'}
              </Text>
              {lastButtonAction && lastButtonAction.timestamp === event.timestamp ? (
                <Badge variant="outline" size="sm">
                  <Text className="text-xs">Applied</Text>
                </Badge>
              ) : null}
            </HStack>
          ))}
        </VStack>
      </Card>
    );
  };

  const renderDeviceList = () => {
    if (availableDevices.length === 0 && !isScanning) {
      return (
        <VStack space="md" className="items-center p-4">
          <Bluetooth size={48} color="gray" />
          <Text className="text-center text-gray-500">No audio devices found</Text>
          <Button onPress={handleStartScan} variant="outline">
            <RefreshCw size={16} />
            <ButtonText className="ml-2">Start Scanning</ButtonText>
          </Button>
        </VStack>
      );
    }

    return (
      <VStack space="md">
        <HStack className="items-center justify-between">
          <Heading size="md">Available Devices</Heading>
          <Button onPress={isScanning ? handleStopScan : handleStartScan} variant="outline" size="sm" isDisabled={isConnecting}>
            {isScanning ? (
              <>
                <Spinner size="small" />
                <ButtonText className="ml-2">Stop Scan</ButtonText>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <ButtonText className="ml-2">Scan</ButtonText>
              </>
            )}
          </Button>
        </HStack>

        <ScrollView style={{ maxHeight: 200 }}>
          <VStack space="sm">
            {availableDevices.map((device) => (
              <Card key={device.id} className={`p-4 ${device.isConnected ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                <HStack space="md" className="items-center justify-between">
                  <HStack space="sm" className="flex-1 items-center">
                    <Bluetooth size={20} color={device.isConnected ? 'green' : 'gray'} />
                    <VStack className="flex-1">
                      <Text className="font-medium">{device.name || 'Unknown Device'}</Text>
                      <HStack space="xs" className="items-center">
                        {device.rssi ? (
                          <>
                            <Signal size={12} color="gray" />
                            <Text className="text-xs text-gray-500">{device.rssi} dBm</Text>
                          </>
                        ) : null}
                        {device.hasAudioCapability ? (
                          <Badge variant="outline" size="sm">
                            <Text className="text-xs">Audio</Text>
                          </Badge>
                        ) : null}
                        {device.supportsMicrophoneControl ? (
                          <Badge variant="outline" size="sm">
                            <Text className="text-xs">Mic Control</Text>
                          </Badge>
                        ) : null}
                      </HStack>
                    </VStack>
                  </HStack>

                  {!device.isConnected ? (
                    <Button onPress={() => handleConnectDevice(device)} size="sm" isDisabled={isConnecting}>
                      {isConnecting ? <Spinner size="small" /> : <ButtonText>Connect</ButtonText>}
                    </Button>
                  ) : (
                    <HStack space="xs" className="items-center">
                      <CheckCircle size={16} color="green" />
                      <Text className="text-sm text-green-600">Connected</Text>
                    </HStack>
                  )}
                </HStack>
              </Card>
            ))}
          </VStack>
        </ScrollView>
      </VStack>
    );
  };

  const bluetoothStateError = renderBluetoothState();

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose} snapPoints={[60]}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-white px-4 py-2 dark:bg-gray-800">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="lg" className="w-full py-4">
          <HStack className="items-center justify-between">
            <Heading size="xl">Bluetooth Audio</Heading>
            {connectedDevice && isLiveKitConnected ? (
              <Badge variant="outline">
                <Wifi size={12} />
                <Text className="ml-1 text-xs">LiveKit Active</Text>
              </Badge>
            ) : null}
          </HStack>

          <Box className="min-h-[400px]">
            {bluetoothStateError ? (
              bluetoothStateError
            ) : (
              <VStack space="md">
                {renderConnectionError()}
                {renderConnectedDevice()}
                {renderRecentButtonEvents()}
                {renderDeviceList()}
              </VStack>
            )}
          </Box>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
};

export default BluetoothAudioModal;
