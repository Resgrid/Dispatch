import { Injectable, Inject } from "@angular/core";
import { Subject } from "rxjs/Subject";
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/share';
import * as signalR from "@microsoft/signalr";
import { Action, Store } from "@ngrx/store";
import { HomeState } from "../features/home/store/home.store";
import { environment } from "src/environments/environment";
import { SettingsProvider } from "./settings";
import * as HomeActions from "../features/home/actions/home.actions";

/**
 * When SignalR runs it will add functions to the global $ variable 
 * that you use to create connections to the hub. However, in this
 * class we won't want to depend on any global variables, so this
 * class provides an abstraction away from using $ directly in here.
 */
export class SignalrWindow extends Window {
    $: any;
}

export enum ConnectionState {
    Connecting = 1,
    Connected = 2,
    Reconnecting = 3,
    Disconnected = 4
}

export class ChannelConfig {
    url: string;
    hubName: string;
    channel: string;
}

export class ChannelEvent {
    Name: string;
    ChannelName: string;
    Timestamp: Date;
    Data: any;
    Json: string;

    constructor() {
        this.Timestamp = new Date();
    }
}

class ChannelSubject {
    channel: string;
    subject: Subject<ChannelEvent>;
}

/**
 * SignalRProvider is a wrapper around the functionality that SignalR
 * provides to expose the ideas of channels and events. With this service
 * you can subscribe to specific channels (or groups in signalr speak) and
 * use observables to react to specific events sent out on those channels.
 */
 @Injectable({
    providedIn: 'root'
  })
export class SignalRProvider {

    /**
     * starting$ is an observable available to know if the signalr 
     * connection is ready or not. On a successful connection this
     * stream will emit a value.
     */
    public starting$: Observable<any>;

    /**
     * connectionState$ provides the current state of the underlying
     * connection as an observable stream.
     */
    public connectionState$: Observable<ConnectionState>;

    /**
     * error$ provides a stream of any error messages that occur on the 
     * SignalR connection
     */
    public error$: Observable<string>;

    // These are used to feed the public observables 
    //
    private connectionStateObserver: Observer<ConnectionState>;
    //private connectionStateSubject = new Subject<ConnectionState>();
    private startingSubject = new Subject<any>();
    private errorSubject = new Subject<any>();

    // These are used to track the internal SignalR state 
    //
    private hubConnection: signalR.HubConnection
    private started: boolean = false;

    // An internal array to track what channel subscriptions exist 
    //
    private subjects = new Array<ChannelSubject>();

    constructor(
        private store: Store<HomeState>,
        private settingsProvider: SettingsProvider  
    ) {
        // Set up our observables
        //
        //this.connectionState$ = this.connectionStateSubject.asObservable().share();
        this.connectionState$ = new Observable<ConnectionState>(observer => {
            this.connectionStateObserver = observer;
        }).share(); // share() allows multiple subscribers


        this.error$ = this.errorSubject.asObservable();
        this.starting$ = this.startingSubject.asObservable();

        //this.connectionStateObserver.next(ConnectionState.Connecting);
    }

    /**
     * Start the SignalR connection. The starting$ stream will emit an 
     * event if the connection is established, otherwise it will emit an
     * error.
     */
    public start(): void {
        console.log('SignalR Channel Start()');

        // Now we only want the connection started once, so we have a special
        //  starting$ observable that clients can subscribe to know know if
        //  if the startup sequence is done.
        //
        // If we just mapped the start() promise to an observable, then any time
        //  a client subscried to it the start sequence would be triggered
        //  again since it's a cold observable.
        //
        if (!this.started) {
            try {
                this.connectionStateObserver.next(ConnectionState.Connecting);

                this.hubConnection = new signalR.HubConnectionBuilder()
                    .withUrl(environment.channelUrl + environment.channelHubName)
                    .build();

                this.hubConnection
                    .start()
                    .then(() => {
                        console.log('Connection started');
                        this.connectionStateObserver.next(ConnectionState.Connected);

                        this.hubConnection.invoke("connect", this.settingsProvider.settings.DepartmentId).then(() => {
                            console.log(`Successfully subscribed to Connect channel with ${this.settingsProvider.settings.DepartmentId.toString()}`);
                        }).catch((error: any) => {
                            console.log(`Error subscribed to Connect channel with ${this.settingsProvider.settings.DepartmentId.toString()}, ERROR: ${error}`);
                        });

                        this.started = true;
                    })
                    .catch(err => {
                        console.log('Error while starting connection: ' + err);
                        this.connectionStateObserver.next(ConnectionState.Disconnected);
                        this.errorSubject.next(err);
                    });

                // SignalR Event Listeners
                this.hubConnection.on('personnelStatusUpdated', (data: any) => {
                    console.log('PersonnelStatusUpdated');
                    this.store.dispatch(new HomeActions.GetLatestPersonnelData());
                });

                this.hubConnection.on('personnelStaffingUpdated', (data: any) => {
                    console.log('PersonnelStaffingUpdated');
                    this.store.dispatch(new HomeActions.GetLatestPersonnelData());
                });

                this.hubConnection.on('unitStatusUpdated', (data: any) => {
                    console.log('UnitStatusUpdated');
                    this.store.dispatch(new HomeActions.GetLatestUnitStates());
                });

                this.hubConnection.on('callsUpdated', (data: any) => {
                    console.log('CallsUpdated');
                    this.store.dispatch(new HomeActions.GetLatestCalls());
                });

                this.hubConnection.on('onConnected', (data: any) => {
                    console.log(`onConnected with ${data}`);
                    //this.widgetPubSub.emitSignalRConnected(data);
                });
            } catch (ex) {
                console.log(ex);
            }
        }
    }

    public subscribeToDepartment(linkId: number): void {
        this.hubConnection.invoke("SubscribeToDepartmentLink", linkId)
            .then(() => console.log(`Successfully subscribed to department link with ${linkId}`))
            .catch(err => console.log(`Error subscribed to department link with ${linkId}, ERROR: ${err}`))
    }

    /** 
     * Get an observable that will contain the data associated with a specific 
     * channel 
     * */
    private sub(channel: string, data?: string): Observable<ChannelEvent> {

        // Try to find an observable that we already created for the requested 
        //  channel
        //
        let channelSub = this.subjects.find((x: ChannelSubject) => {
            return x.channel === channel;
        }) as ChannelSubject;

        // If we already have one for this event, then just return it
        //
        if (channelSub !== undefined) {
            console.log(`Found existing observable for ${channel} channel`)
            return channelSub.subject.asObservable();
        }

        //
        // If we're here then we don't already have the observable to provide the
        //  caller, so we need to call the server method to join the channel 
        //  and then create an observable that the caller can use to received
        //  messages.
        //

        // Now we just create our internal object so we can track this subject
        //  in case someone else wants it too
        //
        channelSub = new ChannelSubject();
        channelSub.channel = channel;
        channelSub.subject = new Subject<ChannelEvent>();
        this.subjects.push(channelSub);

        // Now SignalR is asynchronous, so we need to ensure the connection is
        //  established before we call any server methods. So we'll subscribe to 
        //  the starting$ stream since that won't emit a value until the connection
        //  is ready
        //
        this.starting$.subscribe(() => {
            this.hubConnection.invoke(channel, data)
                .then(() => console.log(`Successfully subscribed to ${channel} channel with ${data}`))
                .catch(err => channelSub.subject.error(err))
        },
            (error: any) => {
                channelSub.subject.error(error);
            });

        return channelSub.subject.asObservable();
    }

    // Not quite sure how to handle this (if at all) since there could be
    //  more than 1 caller subscribed to an observable we created
    //
    // unsubscribe(channel: string): Rx.Observable<any> {
    //     this.observables = this.observables.filter((x: ChannelObservable) => {
    //         return x.channel === channel;
    //     });
    // }

    /** publish provides a way for calles to emit events on any channel. In a 
     * production app the server would ensure that only authorized clients can
     * actually emit the message, but here we're not concerned about that.
     */
    private publish(ev: ChannelEvent): void {
        this.hubConnection.invoke("Publish", ev);
    }

}