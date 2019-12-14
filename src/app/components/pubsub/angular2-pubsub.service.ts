import { Injectable } from '@angular/core';
import { Observable, Subscription, ReplaySubject } from 'rxjs';

const ServiceName: string = 'PubSub Service';

@Injectable()
export class PubSubService implements IPubSubService {
	private events = { };

	constructor() { }

	public $sub(event: string): Observable<any>;
	public $sub(event: string, callback: (value: any) => void): Subscription;
	public $sub(event: string, callback: (value: any) => void, error: (error: any) => void): Subscription;
	public $sub(event: string, callback: (value: any) => void, error: (error: any) => void, complete: () => void): Subscription;
	public $sub(event: string, callback?: (value: any) => void, error?: (error: any) => void, complete?: () => void) {
		if (!event) {
			throw new Error(`[${ServiceName}] => Subscription method must get event name.`);
		}

		if (this.events[event] === undefined) {
			this.events[event] = new ReplaySubject<any>();
		}

		if (typeof callback !== 'function') {
			return this.events[event].asObservable();
		} else {
			return this.events[event].asObservable().subscribe(callback, error, complete);
		}
	}

	public $pub(event: string, eventObject?: any) {
		if (!event) {
			throw new Error(`[${ServiceName}] => Publish method must get event name.`);
		} else if (!this.events[event]) {
			return;
		}

		this.events[event].next(eventObject);
	}
}

export interface IPubSubService {
	$pub(event: string, eventObject?: any);
	$sub(event: string): Observable<any>;
	$sub(event: string, callback: (value: any) => void): Subscription;
	$sub(event: string, callback: (value: any) => void, error: (error: any) => void): Subscription;
	$sub(event: string, callback: (value: any) => void, error: (error: any) => void, complete: () => void): Subscription;
}

interface I$sub{
	(event: string): Observable<any>;
	(event: string, callback: (value: any) => void): Subscription;
	(event: string, callback: (value: any) => void, error: (error: any) => void): Subscription;
	(event: string, callback: (value: any) => void, error: (error: any) => void, complete: () => void): Subscription;
}
