import { Injectable, Inject } from '@angular/core';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';
import { Consts } from '../consts';
import { PubSubService } from '../components/pubsub/angular2-pubsub.service';
import { SettingsProvider } from './settings';

import { SignalR, SignalRConnection, BroadcastEventListener, ISignalRConnection } from 'ng2-signalr';
import { Subscription } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class EventingProvider {
    private connection: ISignalRConnection;

    private personnelStatusEvent: BroadcastEventListener<any>;
    private personnelStaffingEvent: BroadcastEventListener<any>;
    private unitStatusEvent: BroadcastEventListener<any>;
    private callsEvent: BroadcastEventListener<any>;

    private personnelStatusSubscription: Subscription;
    private personnelStaffingSubscription: Subscription;
    private unitStatusSubscription: Subscription;
    private callsSubscription: Subscription;

    constructor(private consts: Consts,
        @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig,
        private pubsub: PubSubService,
        private settingsProvider: SettingsProvider,
        private signalR: SignalR) {

    }

    public init() {
        this.logout();

        if (this.settingsProvider.areSettingsSet() && this.settingsProvider.getEnableLiveUpdates()) {
            try {
                this.signalR.connect().then((c: ISignalRConnection) => {
                    const that = this;
                    this.connection = c;

                    if (c) {
                        this.personnelStatusEvent = new BroadcastEventListener<any>('personnelStatusUpdated');
                        this.personnelStaffingEvent = new BroadcastEventListener<any>('personnelStaffingUpdated');
                        this.unitStatusEvent = new BroadcastEventListener<any>('unitStatusUpdated');
                        this.callsEvent = new BroadcastEventListener<any>('callsUpdated');

                        this.connection.listen(this.personnelStatusEvent);
                        this.connection.listen(this.personnelStaffingEvent);
                        this.connection.listen(this.unitStatusEvent);
                        this.connection.listen(this.callsEvent);

                        this.personnelStatusSubscription = this.personnelStatusEvent.subscribe((data) => {
                            that.pubsub.$pub(that.consts.SIGNALR_EVENTS.PERSONNEL_STATUS_UPDATED, '');
                        });

                        this.personnelStaffingSubscription = this.personnelStaffingEvent.subscribe((data) => {
                            that.pubsub.$pub(that.consts.SIGNALR_EVENTS.PERSONNEL_STAFFING_UPDATED, '');
                        });

                        this.unitStatusSubscription = this.unitStatusEvent.subscribe((data) => {
                            that.pubsub.$pub(that.consts.SIGNALR_EVENTS.UNIT_STATUS_UPDATED, '');
                        });

                        this.callsSubscription = this.callsEvent.subscribe((data) => {
                            that.pubsub.$pub(that.consts.SIGNALR_EVENTS.CALLS_UPDATED, '');
                        });

                        this.connection.invoke('Connect', this.settingsProvider.getDepartmentId())
                            .then((result: any) => {

                            })
                            .catch((err: any) => {

                            });
                    }
                });
            } catch (ex) {
                console.log(ex);
            }
        }
    }

    public logout() {
        if (this.connection) {
            this.connection.stop();
            this.connection = null;
            this.personnelStatusEvent = null;
            this.personnelStaffingEvent = null;
            this.unitStatusEvent = null;
            this.callsEvent = null;

            if (this.personnelStatusSubscription) {
                this.personnelStatusSubscription.unsubscribe();
            }

            if (this.personnelStaffingSubscription) {
                this.personnelStaffingSubscription.unsubscribe();
            }

            if (this.unitStatusSubscription) {
                this.unitStatusSubscription.unsubscribe();
            }

            if (this.callsSubscription) {
                this.callsSubscription.unsubscribe();
            }

            this.personnelStatusSubscription = null;
            this.personnelStaffingSubscription = null;
            this.unitStatusSubscription = null;
            this.callsSubscription = null;
        }
    }
}
