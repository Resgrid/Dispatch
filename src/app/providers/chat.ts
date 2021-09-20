import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

import { SettingsProvider } from './settings';

import { PersonnelChatResult } from '../core/models/personnelChatResult';
import { ResponderChatResult } from '../core/models/responderChatResult';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ChatProvider {

  constructor(public http: HttpClient,
    private settingsProvider: SettingsProvider) {
  }

  public getChatData(): Observable<ResponderChatResult> {
    return this.http.get<ResponderChatResult>(environment.baseApiUrl + environment.resgridApiUrl + '/Chat/GetResponderChatInfo')
      .pipe(map((item) => {
        return item as ResponderChatResult;
      }));
  }

  public getPersonnelChatData(): Observable<PersonnelChatResult[]> {
    return this.http.get<PersonnelChatResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Chat/GetPersonnelForChat')
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

    this.http.post(environment.baseApiUrl + environment.resgridApiUrl + '/Chat/NotifyNewChat', {
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
