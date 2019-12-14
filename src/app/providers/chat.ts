import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';

import { SettingsProvider } from './settings';

import { PersonnelChatResult } from '../models/personnelChatResult';
import { ResponderChatResult } from '../models/responderChatResult';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChatProvider {

  constructor(public http: HttpClient,
    private settingsProvider: SettingsProvider,
    @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig) {
  }

  public getChatData(): Observable<ResponderChatResult> {
    return this.http.get<ResponderChatResult>(this.appConfig.ResgridApiUrl + '/Chat/GetResponderChatInfo')
      .pipe(map((item) => {
        return item as ResponderChatResult;
      }));
  }

  public getPersonnelChatData(): Observable<PersonnelChatResult[]> {
    return this.http.get<PersonnelChatResult[]>(this.appConfig.ResgridApiUrl + '/Chat/GetPersonnelForChat')
      .pipe(map((items) => {
        return items as PersonnelChatResult[];
      }));
  }

  public notifyNewChatMessage(chatId, groupName, message, type, users) {

    // type 0 = user chat
    // type 1 = group chat

    if (!type) {
      type = 0;
    }

    this.http.post(this.appConfig.ResgridApiUrl + '/Chat/NotifyNewChat', {
      Id: chatId,
      GroupName: groupName,
      SendingUserId: this.settingsProvider.getUserId(),
      RecipientUserIds: users,
      Message: message,
      Type: type
    }).subscribe(
      () => {

      });
  }
}
