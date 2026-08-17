import { AlertTriangleIcon, CalendarIcon, ClockIcon, EyeIcon, EyeOffIcon, ShieldAlertIcon, UserIcon } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

import { useAnalytics } from '@/hooks/use-analytics';
import { type ContactNoteResultData } from '@/models/v4/contacts/contactNoteResultData';
import { useContactsStore } from '@/stores/contacts/store';
import { sanitizeHtmlContent } from '@/utils/html-sanitizer';

import { Box } from '../ui/box';
import { Card } from '../ui/card';
import { HStack } from '../ui/hstack';
import { Spinner } from '../ui/spinner';
import { Text } from '../ui/text';
import { VStack } from '../ui/vstack';

interface ContactNotesListProps {
  contactId: string;
}

interface ContactNoteCardProps {
  note: ContactNoteResultData;
}

const ContactNoteCard: React.FC<ContactNoteCardProps> = ({ note }) => {
  const { t } = useTranslation();

  const isExpired = note.ExpiresOnUtc && new Date(note.ExpiresOnUtc) < new Date();
  const isInternal = note.Visibility === 0;

  const { colorScheme } = useColorScheme();
  const textColor = colorScheme === 'dark' ? '#FFFFFF' : '#000000';
  const backgroundColor = colorScheme === 'dark' ? '#374151' : '#F9FAFB';

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Fallback display for empty or plain text notes
  const isPlainText = !note.Note || !note.Note.includes('<');
  const noteContent = note.Note || '(No content)';

  return (
    <Card className={`mb-3 p-4 ${isExpired ? 'opacity-60' : ''}`}>
      <VStack space="sm">
        {/* Header with type and indicators */}
        <HStack className="items-center justify-between">
          <HStack space="xs" className="items-center">
            {note.NoteType ? <Text className="rounded bg-primary-100 px-2 py-1 text-xs font-medium text-primary-800 dark:bg-primary-900 dark:text-primary-200">{note.NoteType}</Text> : null}
            {note.ShouldAlert ? (
              <HStack space="xs" className="items-center">
                <ShieldAlertIcon size={14} color="#ef4444" />
                <Text className="text-xs text-red-600 dark:text-red-400">{t('contacts.noteAlert')}</Text>
              </HStack>
            ) : null}
          </HStack>

          <HStack space="xs" className="items-center">
            {isInternal ? (
              <HStack space="xs" className="items-center">
                <EyeOffIcon size={14} color="#6b7280" />
                <Text className="text-xs text-gray-500 dark:text-gray-400">{t('contacts.internal')}</Text>
              </HStack>
            ) : (
              <HStack space="xs" className="items-center">
                <EyeIcon size={14} color="#6b7280" />
                <Text className="text-xs text-gray-500 dark:text-gray-400">{t('contacts.public')}</Text>
              </HStack>
            )}
          </HStack>
        </HStack>

        {/* Note content */}
        <Box className="min-h-[200px] rounded bg-gray-50 p-3 dark:bg-gray-800">
          {isPlainText ? (
            <Text className="text-gray-800 dark:text-gray-200" selectable>
              {noteContent}
            </Text>
          ) : (
            <WebView
              style={styles.webView}
              // Security: Only allow local content, no external origins
              originWhitelist={['about:']}
              scrollEnabled={true}
              showsVerticalScrollIndicator={true}
              showsHorizontalScrollIndicator={false}
              androidLayerType="software"
              // Security: Disable JavaScript and DOM storage by default
              // Only re-enable for pre-sanitized, trusted content that requires it
              javaScriptEnabled={false}
              domStorageEnabled={false}
              startInLoadingState={false}
              mixedContentMode="compatibility"
              // Security: Handle navigation to prevent in-WebView navigation and open external links safely
              onShouldStartLoadWithRequest={(request) => {
                // Allow initial load of our HTML content
                if (request.url.startsWith('about:') || request.url.startsWith('data:')) {
                  return true;
                }

                // For any external links, open in system browser instead
                Linking.openURL(request.url);
                return false;
              }}
              onNavigationStateChange={(navState) => {
                // Additional protection: if navigation occurs to external URL, open in system browser
                if (navState.url && !navState.url.startsWith('about:') && !navState.url.startsWith('data:')) {
                  Linking.openURL(navState.url);
                }
              }}
              source={{
                html: `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                      <style>
                        html, body {
                          margin: 0;
                          padding: 12px;
                          width: 100%;
                          height: auto;
                          min-height: 100%;
                          color: ${textColor};
                          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                          font-size: 16px;
                          line-height: 1.6;
                          word-wrap: break-word;
                          overflow-wrap: break-word;
                          background-color: transparent;
                          box-sizing: border-box;
                        }
                        * {
                          max-width: 100%;
                          box-sizing: border-box;
                        }
                        p, div, span {
                          margin: 0 0 12px 0;
                        }
                        p:last-child, div:last-child {
                          margin-bottom: 0;
                        }
                        img {
                          max-width: 100%;
                          height: auto;
                        }
                        a {
                          color: ${colorScheme === 'dark' ? '#60A5FA' : '#3B82F6'};
                          text-decoration: none;
                        }
                        a:hover {
                          text-decoration: underline;
                        }
                        ul, ol {
                          padding-left: 20px;
                          margin: 12px 0;
                        }
                        li {
                          margin: 4px 0;
                        }
                        blockquote {
                          border-left: 4px solid ${colorScheme === 'dark' ? '#60A5FA' : '#3B82F6'};
                          margin: 12px 0;
                          padding-left: 16px;
                          font-style: italic;
                        }
                        pre, code {
                          background-color: ${colorScheme === 'dark' ? '#1F2937' : '#F3F4F6'};
                          padding: 8px;
                          border-radius: 4px;
                          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                          font-size: 14px;
                        }
                        table {
                          width: 100%;
                          border-collapse: collapse;
                          margin: 12px 0;
                        }
                        th, td {
                          border: 1px solid ${colorScheme === 'dark' ? '#374151' : '#E5E7EB'};
                          padding: 8px;
                          text-align: left;
                        }
                        th {
                          background-color: ${colorScheme === 'dark' ? '#1F2937' : '#F9FAFB'};
                          font-weight: bold;
                        }
                      </style>
                    </head>
                    <body>${sanitizeHtmlContent(noteContent)}</body>
                  </html>
                `,
              }}
            />
          )}
        </Box>

        {/* Expiration warning */}
        {isExpired ? (
          <HStack space="xs" className="items-center rounded bg-red-50 p-2 dark:bg-red-900/20">
            <AlertTriangleIcon size={16} color="#ef4444" />
            <Text className="text-sm font-medium text-red-600 dark:text-red-400">{t('contacts.contactNotesExpired')}</Text>
          </HStack>
        ) : note.ExpiresOn ? (
          <HStack space="xs" className="items-center">
            <ClockIcon size={14} color="#6b7280" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {t('contacts.expires')}: {formatDate(note.ExpiresOn)}
            </Text>
          </HStack>
        ) : null}

        {/* Footer with author and date */}
        <HStack className="items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-700">
          <HStack space="xs" className="items-center">
            <UserIcon size={14} color="#6b7280" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">{note.AddedByName}</Text>
          </HStack>

          <HStack space="xs" className="items-center">
            <CalendarIcon size={14} color="#6b7280" />
            <Text className="text-xs text-gray-500 dark:text-gray-400">{formatDate(note.AddedOn)}</Text>
          </HStack>
        </HStack>
      </VStack>
    </Card>
  );
};

export const ContactNotesList: React.FC<ContactNotesListProps> = ({ contactId }) => {
  const { t } = useTranslation();
  const { trackEvent } = useAnalytics();
  const { contactNotes, isNotesLoading, fetchContactNotes } = useContactsStore();

  React.useEffect(() => {
    if (contactId) {
      fetchContactNotes(contactId);
    }
  }, [contactId, fetchContactNotes]);

  const notes = contactNotes[contactId] || [];
  const hasNotes = notes.length > 0;

  // Track when contact notes list is rendered
  React.useEffect(() => {
    if (contactId) {
      trackEvent('contact_notes_list_rendered', {
        contactId: contactId,
        notesCount: notes.length,
        hasNotes: hasNotes,
        isLoading: isNotesLoading,
      });
    }
  }, [trackEvent, contactId, notes.length, hasNotes, isNotesLoading]);

  if (isNotesLoading) {
    return (
      <Box className="flex-1 items-center justify-center py-8">
        <Spinner size="large" className="mb-4" />
        <Text className="text-center text-gray-500 dark:text-gray-400">{t('contacts.contactNotesLoading')}</Text>
      </Box>
    );
  }

  if (!hasNotes) {
    return (
      <Box className="flex-1 items-center justify-center py-8">
        <VStack space="md" className="items-center">
          <Box className="size-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <CalendarIcon size={32} color="#6b7280" />
          </Box>
          <VStack space="xs" className="items-center">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">{t('contacts.contactNotesEmpty')}</Text>
            <Text className="text-center text-gray-500 dark:text-gray-400">{t('contacts.contactNotesEmptyDescription')}</Text>
          </VStack>
        </VStack>
      </Box>
    );
  }

  // Sort notes by date (newest first)
  const sortedNotes = [...notes].sort((a, b) => {
    const dateA = new Date(a.AddedOnUtc || a.AddedOn);
    const dateB = new Date(b.AddedOnUtc || b.AddedOn);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <VStack space="md" className="flex-1 p-4">
      {sortedNotes.map((note) => (
        <ContactNoteCard key={note.ContactNoteId} note={note} />
      ))}
    </VStack>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  webView: {
    height: 200, // Fixed height with scroll capability
    backgroundColor: 'transparent',
    width: '100%',
  },
});
