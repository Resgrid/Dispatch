import { Injectable, Inject, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Platform, ModalController, Nav, App } from 'ionic-angular';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';
import { Push, PushObject, PushOptions, CategoryArray, CategoryAction, CategoryActionData, AndroidPushOptions, IOSPushOptions } from '@ionic-native/push';
import { Notifying } from '../components/notifying/notifying';
import { SettingsProvider } from './settings';
import { PubSubService } from '../components/pubsub/angular2-pubsub.service';
import { Consts } from '../consts';
import { NotificationProvider } from './notification';
import { DataProvider } from './data';
import { FileProvider } from './file';

import { CallDetailPage } from '../pages/call-detail/call-detail';

declare var PushNotification: any;
declare var cordova: any;

@Injectable({
  providedIn: 'root'
})
export class PushProvider {
  private pushObject: PushObject;
  private dataSyncedSub: any;

  constructor(private http: HttpClient,
    public push: Push,
    private platform: Platform,
    @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig,
    public app: App,
    public modalCtrl: ModalController,
    private settingsProvider: SettingsProvider,
    private pubsub: PubSubService,
    private notificationProvider: NotificationProvider,
    private consts: Consts,
    private dataProvider: DataProvider,
    private fileProvider: FileProvider) {

  }

  register() {
    if (!this.platform.is('cordova')) {
      console.warn('Push notifications not initialized. Cordova is not available - Run in physical device');
      return;
    }

    if (!this.dataSyncedSub) {
      this.dataSyncedSub = this.pubsub.$sub(this.consts.EVENTS.COREDATASYNCED).subscribe((from) => {
        // this.downloadPushSounds();
      });
    }

    /*
    const options: PushOptions = {
      android: <AndroidPushOptions>{
        senderID: '343968022249',
        clearBadge: true,
        clearNotifications: true,
        sound: true,
        vibrate: true,
        forceShow: true,
        icon: 'pushicon',
        iconColor: '#208BCB'
      },
      ios: <IOSPushOptions>{
        alert: 'true',
        badge: true,
        sound: 'true',
        clearBadge: 'true',
        categories: <CategoryArray>{
          'CALLS': <CategoryAction>{
            yes: <CategoryActionData>{
              callback: 'pushActionResponding', title: 'Resp', foreground: true, destructive: false
            },
            no: <CategoryActionData>{
              callback: 'pushActionNotResponding', title: 'Not Resp', foreground: true, destructive: true
            }
          }
        }
      },
      windows: {}
    };
*/
    const options = {
      android: {
        senderID: '343968022249',
        clearBadge: true,
        clearNotifications: true,
        sound: true,
        vibrate: true,
        forceShow: true,
        icon: 'pushicon',
        iconColor: '#208BCB'
      },
      ios: {
        alert: true,
        badge: true,
        sound: true,
        clearBadge: true,
        categories: {
          'CALLS': {
            yes: {
              callback: 'pushActionResponding', title: 'Resp', foreground: true, destructive: false
            },
            no: {
              callback: 'pushActionNotResponding', title: 'Not Resp', foreground: true, destructive: true
            }
          }
        }
      },
      windows: {}
    };

    if (this.settingsProvider.areSettingsSet() && this.settingsProvider.isAuthenticated && this.settingsProvider.getEnablePushNotifications()) {
      let that = this;

      that.pushObject = that.push.init(options);

      if (window['cordova'] && window['PushNotification']) {
        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'calls',
            description: 'Generic Call',
            importance: 5,
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: '0',
            description: 'Low Call',
            importance: 5,
            sound: 'calllow',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: '1',
            description: 'Medium Call',
            importance: 5,
            sound: 'callmedium',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: '2',
            description: 'High Call',
            importance: 5,
            sound: 'callhigh',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: '3',
            description: 'Emergency Call',
            importance: 5,
            sound: 'callemergency',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'notif',
            description: 'Notifications',
            importance: 5,
            vibration: false,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'message',
            description: 'Messages',
            importance: 5,
            vibration: false,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c1',
            description: 'Custom Call Tone 1',
            importance: 5,
            sound: 'c1',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c2',
            description: 'Custom Call Tone 2',
            importance: 5,
            sound: 'c2',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c3',
            description: 'Custom Call Tone 3',
            importance: 5,
            sound: 'c3',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c4',
            description: 'Custom Call Tone 4',
            importance: 5,
            sound: 'c4',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c5',
            description: 'Custom Call Tone 5',
            importance: 5,
            sound: 'c5',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c6',
            description: 'Custom Call Tone 6',
            importance: 5,
            sound: 'c6',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c7',
            description: 'Custom Call Tone 7',
            importance: 5,
            sound: 'c7',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c8',
            description: 'Custom Call Tone 8',
            importance: 5,
            sound: 'c8',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c9',
            description: 'Custom Call Tone 9',
            importance: 5,
            sound: 'c9',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c10',
            description: 'Custom Call Tone 10',
            importance: 5,
            sound: 'c10',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c11',
            description: 'Custom Call Tone 11',
            importance: 5,
            sound: 'c11',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c12',
            description: 'Custom Call Tone 12',
            importance: 5,
            sound: 'c12',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c13',
            description: 'Custom Call Tone 13',
            importance: 5,
            sound: 'c13',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c14',
            description: 'Custom Call Tone 14',
            importance: 5,
            sound: 'c14',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c15',
            description: 'Custom Call Tone 15',
            importance: 5,
            sound: 'c15',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c16',
            description: 'Custom Call Tone 16',
            importance: 5,
            sound: 'c16',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c17',
            description: 'Custom Call Tone 17',
            importance: 5,
            sound: 'c17',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c18',
            description: 'Custom Call Tone 18',
            importance: 5,
            sound: 'c18',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c19',
            description: 'Custom Call Tone 19',
            importance: 5,
            sound: 'c19',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c20',
            description: 'Custom Call Tone 20',
            importance: 5,
            sound: 'c20',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c21',
            description: 'Custom Call Tone 21',
            importance: 5,
            sound: 'c21',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c22',
            description: 'Custom Call Tone 22',
            importance: 5,
            sound: 'c22',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c23',
            description: 'Custom Call Tone 23',
            importance: 5,
            sound: 'c23',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c24',
            description: 'Custom Call Tone 24',
            importance: 5,
            sound: 'c24',
            vibration: 1,
            visibility: 1
          });

        PushNotification.createChannel(() => { }, () => { },
          {
            id: 'c25',
            description: 'Custom Call Tone 25',
            importance: 5,
            sound: 'c25',
            vibration: 1,
            visibility: 1
          });
      }

      that.pushObject.on('error').subscribe(error => console.log('Error with Push plugin: ' + error));
      that.pushObject.on('registration').subscribe((data: any) => {
        console.log('device token -> ' + data.registrationId);
        // window.alert('registration -> ' + JSON.stringify(data));
        that.save(data.registrationId);
      });
      that.pushObject.on('notification').subscribe((data: any) => {
        console.log('message -> ' + data.message);
        console.log(JSON.stringify(data));
        // window.alert(JSON.stringify(data));

        // if user using app and push notification comes
        if (data.additionalData.foreground) {
          if (data.additionalData.dcpid) {  // This is an android background notification
            that.triggerLocalNotification(data.additionalData.dcpid, data.additionalData.mtitle, data.additionalData.mbody,
              data.additionalData.dcpid, data.additionalData.color, data.count);
          } else {
            if (data.additionalData.eventCode && data.additionalData.eventCode.trim().indexOf('C', 0) === 0) {
              that.showChatPopup(data.additionalData.eventCode, data.message);
            } else if (data.additionalData.eventCode && data.additionalData.eventCode.trim().indexOf('T', 0) === 0) {
              that.showChatPopup(data.additionalData.eventCode, data.message);
            } else if (data.additionalData.eventCode && data.additionalData.eventCode.trim().indexOf('G', 0) === 0) {
              that.showChatPopup(data.additionalData.eventCode, data.message);
            }
          }
        } else {
          if (data.additionalData.dcpid) {  // This is an android background notification
            that.triggerLocalNotification(data.additionalData.dcpid, data.additionalData.name, data.additionalData.info,
              data.additionalData.dcpid, data.additionalData.color, data.count);
          } else {
            if (data.additionalData.eventCode && data.additionalData.eventCode.trim().indexOf('C', 0) === 0) {
              const callId = data.additionalData.eventCode.trim().replace('C', '');

              that.pubsub.$pub(that.consts.EVENTS.NAV_SETROOT, {
                name: 'CallDetailPage',
                payload: {
                  callId: callId
                }
              });
            } else if (data.additionalData.eventCode && data.additionalData.eventCode.trim().indexOf('T', 0) === 0) {
              const userId = data.additionalData.eventCode.trim().replace('T', '');

              that.pubsub.$pub(that.consts.EVENTS.NAV_SETROOT, {
                name: 'ChatRoomPage',
                payload: {
                  userId: userId
                }
              });
            } else if (data.additionalData.eventCode && data.additionalData.eventCode.trim().indexOf('G', 0) === 0) {
              const groupId = data.additionalData.eventCode.trim().replace('G', '');

              that.pubsub.$pub(that.consts.EVENTS.NAV_SETROOT, {
                name: 'ChatGroupRoomPage',
                payload: {
                  groupId: groupId
                }
              });
            }
          }
        }
      });
    }
  }

  public clearBadge() {
    try {
      if (this.pushObject) {
        this.pushObject.setApplicationIconBadgeNumber(0).then(function (e) { });
        this.pushObject.clearAllNotifications().then(function (e) { });
      }
    } catch (e) { }
  }

  public triggerLocalNotification(id: string, title: string, body: string, audio: string, color: string, count: number) {

    if (cordova && cordova.plugins && cordova.plugins.notification && cordova.plugins.notification.local) {
      cordova.plugins.notification.local.setDefaults({
        // led: { color: color, on: 500, off: 500 },
        led: color,
        vibrate: true,
        foreground: true
      });

      const soundPath = this.fileProvider.getSoundFullPath('CallPAudio_' + audio);
      console.log('local sound path: ' + soundPath);

      cordova.plugins.notification.local.schedule({
        id: 1,
        title: body,
        text: title,
        badge: count,
        led: color,
        priority: 2,
        sticky: true,
        lockscreen: true,
        foreground: true,
        vibrate: true,
        sound: soundPath
        // led: {
        //  color: color,
        //  on: 3,
        //  off: 3
        // }// ,
        // data: { secret: key }
      });
    }
  }

  public save(id: string) {
    let platform: number = 0;

    if (this.platform.is('ios')) {
      platform = 1;
    } else if (this.platform.is('android')) {
      platform = 3;
    } else if (this.platform.is('windows')) {
      platform = 4;
    }

    console.log('push save platform: ' + platform);
    // window.alert('push save platform: ' + platform + ' reg ' + id);

    this.http.post(this.appConfig.ResgridApiUrl + '/Devices/RegisterDevice', {
      Did: id,
      Plt: platform
    }).subscribe(
      () => {
        console.log('push registered');
        this.settingsProvider.setPushRegisteredOn();
      });
  }

  public downloadPushSounds() {
    this.dataProvider.getActivePriorites().then((priorities) => {
      priorities.forEach(priority => {
        if (priority.Id > 3) {
          let url;
          let fileName;
          if (this.platform.is('android')) {
            url = this.appConfig.ResgridApiUrl + '/CallPriorities/GetPushAudioForPriority?priorityId=' + priority.Id;
            fileName = 'CallPAudio_' + priority.Id + '.mp3';
          } else {
            url = this.appConfig.ResgridApiUrl + '/CallPriorities/GetIOSPushAudioForPriority?priorityId=' + priority.Id;
            fileName = 'CallPAudio_' + priority.Id + '. caf';
          }

          if (window['cordova'] && window['PushNotification']) {
            try {
              const soundFile = this.fileProvider.getSoundFullPath('CallPAudio_' + priority.Id);
              console.log(soundFile);

              PushNotification.createChannel(() => { }, () => { },
                {
                  id: 'CallPAudio_' + priority.Id,
                  description: 'Custom Call ' + priority.Name,
                  importance: 5,
                  // vibration: 1,
                  // vibration: [2000, 500, 1000, 500],
                  vibration: 1,
                  // vibration: 1,
                  visibility: 1,
                  // sound: this.fileProvider.getSoundFullPath('CallPAudio_' + priority.Id)
                  // sound: 'CallPAudio_' + priority.Id// + '.mp3'
                  sound: 'c1'
                });
            } catch (ex) {
              console.log(JSON.stringify(ex));
            }
          }

          this.fileProvider.doesFileExist(fileName).then((doesFileExist) => {
            if (!doesFileExist) {
              this.fileProvider.download(url, fileName).then((isFileDownloaded) => {

                if (isFileDownloaded) {
                  // window.alert('downloaded file');
                }
              }, (error) => {
                console.log(error);
              });
            }
          });
        }
      });
    });
  }

  private showCallPopup(callId, message) {
    const confirmNotify = this.modalCtrl.create(Notifying,
      {
        type: 'info',
        title: 'New Call',
        message: message + ' Do you want to view now?',
        textOk: 'Yes',
        textCancel: 'No',
        isConfirm: function () {
          // write here your code of function
        },
        isCancel: function () {
          // write here your code of function
        }
      }
    );
    confirmNotify.onDidDismiss(data => {
      if (data.res === 'yes') {

        this.app.getActiveNav().push('CallDetailPage', {
          callId: callId
        });
      } else if (data.res === 'no') {

      }
    });
    confirmNotify.present();
  }

  private showChatPopup(chatId, message) {
    const confirmNotify = this.modalCtrl.create(Notifying,
      {
        type: 'info',
        title: 'New Chat',
        message: message,
        textOk: 'View',
        textCancel: 'Close',
        isConfirm: function () {
          // write here your code of function
        },
        isCancel: function () {
          // write here your code of function
        }
      }
    );
    confirmNotify.onDidDismiss(data => {
      if (data.res === 'yes') {
        if (data.additionalData.eventCode && data.additionalData.eventCode.trim().indexOf('C', 0) === 0) {
          const callId = data.additionalData.eventCode.trim().replace('C', '');

          this.pubsub.$pub(this.consts.EVENTS.NAV_PUSH, {
            name: 'CallDetailPage',
            payload: {
              callId: callId
            }
          });
        } else if (data.additionalData.eventCode && data.additionalData.eventCode.trim().indexOf('T', 0) === 0) {
          const userId = data.additionalData.eventCode.trim().replace('T', '');

          this.pubsub.$pub(this.consts.EVENTS.NAV_PUSH, {
            name: 'ChatRoomPage',
            payload: {
              userId: userId
            }
          });
        } else if (data.additionalData.eventCode && data.additionalData.eventCode.trim().indexOf('G', 0) === 0) {
          const groupId = data.additionalData.eventCode.trim().replace('G', '');

          this.pubsub.$pub(this.consts.EVENTS.NAV_PUSH, {
            name: 'ChatGroupRoomPage',
            payload: {
              groupId: groupId
            }
          });
        }
      } else if (data.res === 'no') {

      }
    });
    confirmNotify.present();
  }
}
