import { Injectable } from '@angular/core';

@Injectable({
	providedIn: 'root'
})
export class Consts {
	public LANG_KEY = 'lang';
	public LANG_EN = 'en';
	public HAS_SEEN_TUTORIAL_KEY = 'hasSeenTutorial';

	public EVENTS = {
		LOGGED_IN: 'userLoggedIn',
		SYSTEM_READY: 'systemReady',
		COREDATASYNCED: 'coreDataSynced',
		LOCAL_DATA_SET: 'localDataSet',
		SETTINGS_SAVED: 'settingsSaved',
		MESSAGE_RECIPIENT_ADDED: 'messageRecipientAdded',
		REGISTRATION_OPERATION_FINISHED: 'registrationOperationFinished',
		CORDOVA_DEVICE_RESUMED: 'onResumeCordova',
		CORDOVA_DEVICE_PAUSED: 'onPauseCordova',
		HIDE_SPLASH_SCREEN: 'hideSplashScreen',
		STATUS_UPDATED: 'statusUpdated',
		STATUS_QUEUED: 'statusQueued',
		STAFFING_UPDATED: 'statusUpdated',
		SECURITY_SET: 'securitySet',
		NAV_PUSH: 'navPush',
		NAV_SETROOT: 'navSetRoot'
	}

	public SIGNALR_EVENTS = {
		PERSONNEL_STATUS_UPDATED: 'PersonnelStatusUpdated',
		PERSONNEL_STAFFING_UPDATED: 'PersonnelStaffingUpdated',
		UNIT_STATUS_UPDATED: 'UnitStatusUpdated',
		CALLS_UPDATED: 'CallsUpdated'
	}

	public DOCTYPES = {
		PERSONNEL: 1,
		GROUPS: 2,
		UNITS: 3,
		ROLES: 4,
		STATUSES: 5,
		PRIORITIES: 6,
		DEPARTMENTS: 7
	}

	public STATUS = {
		STANDINGBY: 0,
		NOTRESPONDING: 1,
		RESPONDING: 2,
		ONSCENE: 3,
		AVAILABLESTATION: 4,
		RESPONDINGTOSTATION: 5,
		RESPONDINGTOSCENE: 6
	}

	public STAFFING = {
		NORMAL: 0,
		DELAYED: 1,
		UNAVAILABLE: 2,
		COMMITTED: 3,
		ONSHIFT: 4
	}

	public DETAILTYPES = {
		NONE: 0,
		STATIONS: 1,
		CALLS: 2,
		CALLSANDSTATIONS: 3
	}

	public NOTETYPES = {
		NONE: 0,
		OPTIONAL: 1,
		REQUIRED: 2
	}

	public CUSTOMTYPES = {
		PERSONNEL: 1,
		UNIT: 2,
		STAFFING: 3
	}

	public MESSAGETYPES = {
		NORMAL: 0,
		CALLBACK: 1,
		POLL: 2
	}

	public GROUPTYPES = {
		ORG: 1,
		STATION: 2
	}

	public DESTTYPES = {
		STATION: 1,
		CALL: 2
	}

	public CACHE = {
		PERSON_DETAIL: 'personDetail',
		UNIT_DETAIL: 'unitDetail'
	}
}
