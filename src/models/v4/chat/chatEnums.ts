/**
 * Chat domain enums. Values mirror the Resgrid v4 Chat API contract exactly.
 */

/** Channel type (ChatChannelResultData.ChannelType). */
export enum ChatChannelType {
  DirectMessage = 0,
  AdHocGroup = 1,
  DepartmentDefault = 2,
  GroupDefault = 3,
  CustomLocked = 4,
  Incident = 5,
  IncidentLane = 6,
  IncidentCommand = 7,
  Chatbot = 8,
  /** IC plus every lane's primary/secondary lead — command talking to the people running the lanes. */
  IncidentLeads = 9,
  /** The incident's line to the dispatch desk: everyone on the incident, plus every authorized dispatcher. */
  IncidentDispatch = 10,
  /** A unit's standing line to the dispatch desk: the unit identity plus every authorized dispatcher. Department-wide, not call-scoped. */
  UnitDispatch = 11,
}

/** Message type (ChatMessageResultData.MessageType). */
export enum ChatMessageType {
  Text = 0,
  Image = 1,
  Gif = 2,
  Location = 3,
  System = 4,
  Bot = 5,
}

/** Message priority (ChatMessageResultData.Priority). */
export enum ChatMessagePriority {
  Normal = 0,
  Urgent = 1,
}

/** Participant type for senders / members / reactors. */
export enum ChatParticipantType {
  User = 0,
  Unit = 1,
  Bot = 2,
}

/** Per-channel notification preference. */
export enum ChatNotificationPreference {
  Default = 0,
  All = 1,
  MentionsOnly = 2,
  Muted = 3,
}

/** Mention type (ChatMentionInput.MentionType). */
export enum ChatMentionType {
  User = 0,
  Unit = 1,
  Role = 2,
  Group = 3,
  Everyone = 4,
}

/** Reason for flagging a message for moderator review. */
export enum ChatFlagReason {
  Other = 0,
  Inappropriate = 1,
  Harassment = 2,
  Spam = 3,
  SensitiveInformation = 4,
  PolicyViolation = 5,
}

/** Client-only lifecycle status for optimistic messages (never sent by the server). */
export type ChatMessageLocalStatus = 'pending' | 'failed' | 'sent';
