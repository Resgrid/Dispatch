export interface NotificationPayload {
  id: string;
  title?: string;
  body: string;
  createdAt: string;
  read?: boolean;
  type?: string;
  referenceId?: string;
  referenceType?: 'call' | 'message' | 'status' | 'note' | 'chat' | 'other';
  metadata?: Record<string, any>;
}

export interface NotificationDetailProps {
  notification: NotificationPayload;
  onClose: () => void;
  onDelete: (id: string) => void;
  onNavigateToReference: (referenceType: string, referenceId: string) => void;
}
