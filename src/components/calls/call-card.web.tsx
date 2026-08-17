import { AlertTriangle, MapPin, Phone } from 'lucide-react-native';
import React from 'react';

import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { getTimeAgoUtc, invertColor } from '@/lib/utils';
import { type CallPriorityResultData } from '@/models/v4/callPriorities/callPriorityResultData';
import type { CallResultData } from '@/models/v4/calls/callResultData';
import { sanitizeHtmlContent } from '@/utils/html-sanitizer';

function getColor(call: CallResultData, priority: CallPriorityResultData | undefined) {
  if (!call) {
    return '#808080';
  } else if (call.CallId === '0') {
    return '#808080';
  } else if (priority && priority.Color) {
    return priority.Color;
  }

  return '#808080';
}

interface CallCardProps {
  call: CallResultData;
  priority: CallPriorityResultData | undefined;
}

export const CallCard: React.FC<CallCardProps> = ({ call, priority }) => {
  const textColor = invertColor(getColor(call, priority), true);
  const bgColor = getColor(call, priority);
  const destinationText = call.DestinationName ? (call.DestinationTypeName ? `${call.DestinationTypeName}: ${call.DestinationName}` : call.DestinationName) : '';

  return (
    <Box
      style={{
        backgroundColor: bgColor,
      }}
      className={`mb-2 rounded-xl p-2 shadow-xs`}
    >
      {/* Header with Call Number and Priority */}
      <HStack className="mb-4 items-center justify-between">
        <HStack className="items-center space-x-2">
          <AlertTriangle size={20} />
          <Text
            style={{
              color: textColor,
            }}
            className={`text-lg font-bold`}
          >
            #{call.Number}
          </Text>
        </HStack>
        <Text
          style={{
            color: textColor,
          }}
          className="text-sm text-gray-600"
        >
          {getTimeAgoUtc(call.LoggedOnUtc)}
        </Text>
      </HStack>

      {/* Call Details */}
      <VStack className="space-y-3">
        {/* Name */}
        <HStack className="items-center space-x-2">
          <Icon as={Phone} className="text-gray-500" size="md" />
          <Text
            style={{
              color: textColor,
            }}
            className="font-medium text-gray-900"
          >
            {call.Name}
          </Text>
        </HStack>

        {/* Address */}
        <HStack className="items-center space-x-2">
          <Icon as={MapPin} className="text-gray-500" size="md" />
          <Text
            style={{
              color: textColor,
            }}
            className="text-gray-700"
          >
            {call.Address}
          </Text>
        </HStack>

        {destinationText ? (
          <HStack className="items-center space-x-2">
            <Icon as={MapPin} className="text-gray-500" size="md" />
            <Text
              style={{
                color: textColor,
              }}
              className="font-medium text-gray-700"
            >
              {destinationText}
            </Text>
          </HStack>
        ) : null}
      </VStack>

      {/* Nature of Call - Use iframe for web instead of WebView */}
      {call.Nature ? (
        <Box className="mt-4 p-0">
          <div style={{ width: '100%', height: 80, overflow: 'hidden' }}>
            <iframe
              srcDoc={`
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
                    <style>
                      body {
                        color: ${textColor};
                        background-color: ${bgColor};
                        font-family: system-ui, -apple-system, sans-serif;
                        margin: 0;
                        padding: 0;
                        font-size: 16px;
                        line-height: 1.5;
                        overflow: hidden;
                      }
                      * {
                        max-width: 100%;
                      }
                    </style>
                  </head>
                  <body>${sanitizeHtmlContent(call.Nature ?? '')}</body>
                </html>
              `}
              style={{ width: '100%', height: '100%', border: 'none', backgroundColor: bgColor }}
              scrolling="no"
              frameBorder="0"
            />
          </div>
        </Box>
      ) : null}
    </Box>
  );
};
