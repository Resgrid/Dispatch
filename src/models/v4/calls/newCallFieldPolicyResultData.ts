/**
 * The department's new-call form policy: which built-in fields the call form shows, and which it
 * requires before a call can be created and sent to the field.
 *
 * Mirrors Resgrid.Model.NewCallFieldKeys. Keys are stable strings rather than ordinals because they
 * are a wire contract shared by the web app and all five client apps.
 */

export const NewCallFieldKeys = {
  Address: 'address',
  Geolocation: 'geolocation',
  What3Words: 'what3words',
  PlusCode: 'pluscode',
  DestinationPoi: 'destinationPoi',
  IndoorLocation: 'indoorLocation',
  Note: 'note',
  ContactName: 'contactName',
  ContactInfo: 'contactInfo',
  ExternalId: 'externalId',
  IncidentId: 'incidentId',
  ReferenceId: 'referenceId',
  Protocols: 'protocols',
  LinkedCall: 'linkedCall',
  DispatchOn: 'dispatchOn',
  DispatchList: 'dispatchList',
} as const;

export type NewCallFieldKey = (typeof NewCallFieldKeys)[keyof typeof NewCallFieldKeys];

export interface NewCallFieldRuleData {
  Key: string;
  Visible: boolean;
  Required: boolean;
}

export interface NewCallFieldPolicyResultData {
  Rules: NewCallFieldRuleData[];
}
