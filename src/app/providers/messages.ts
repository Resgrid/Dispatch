import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

import { DataProvider } from './data';

import { MessageResult } from '../core/models/messageResult';
import { MessageRecipientResult } from '../core/models/messageRecipientResult';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MessagesProvider {

  constructor(public http: HttpClient, private dataProvider: DataProvider) {

  }

  public getMessages(): Observable<MessageResult[]> {
    return this.http.get<MessageResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Messages/GetMessages')
      .pipe(map((items) => {
        let messages: MessageResult[] = new Array<MessageResult>();

        items.forEach(item => {
          let message = item as MessageResult;

          const localUser = this.dataProvider.getPerson(item.Uid);
          if (localUser) {
            message.SendingUser = localUser.Fnm + ' ' + localUser.Lnm;
          }

          messages.push(message);
        });

        return messages;
      }));
  }

  public getMessagesPages(page): Observable<MessageResult[]> {
    return this.http.get<MessageResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Messages/GetMessagesPaged?page=' + page)
      .pipe(map((items) => {
        let messages: MessageResult[] = new Array<MessageResult>();

        items.forEach(item => {
          let message = item as MessageResult;

          const localUser = this.dataProvider.getPerson(item.Uid);
          if (localUser) {
            message.SendingUser = localUser.Fnm + ' ' + localUser.Lnm;
          }

          messages.push(message);
        });

        return messages;
      }));
  }


  public getOutboxMessages(): Observable<MessageResult[]> {
    return this.http.get<MessageResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Messages/GetOutboxMessages')
      .pipe(map((items) => {
        let messages: MessageResult[] = new Array<MessageResult>();

        items.forEach(item => {
          let message = item as MessageResult;

          const localUser = this.dataProvider.getPerson(item.Uid);
          if (localUser) {
            message.SendingUser = localUser.Fnm + ' ' + localUser.Lnm;
          }

          messages.push(message);
        });

        return messages;
      }));
  }

  public getOutboxMessagesPages(page): Observable<MessageResult[]> {
    return this.http.get<MessageResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Messages/GetOutboxMessagesPaged?page=' + page)
    .pipe(map((items) => {
        let messages: MessageResult[] = new Array<MessageResult>();

        items.forEach(item => {
          let message = item as MessageResult;

          const localUser = this.dataProvider.getPerson(item.Uid);
          if (localUser) {
            message.SendingUser = localUser.Fnm + ' ' + localUser.Lnm;
          }

          messages.push(message);
        });

        return messages;
      }));
  }

  public getMessage(messageId: any): Observable<MessageResult> {
    const params = new HttpParams().append('messageId', messageId);

    return this.http.get<MessageResult>(environment.baseApiUrl + environment.resgridApiUrl + '/Messages/GetMessage', { params })
    .pipe(map((item) => {
        let message: MessageResult = item as MessageResult;

        let localUser = this.dataProvider.getPerson(item.Uid);
        if (localUser) {
          message.SendingUser = localUser.Fnm + ' ' + localUser.Lnm;
        }

        if (message.Rcpts) {
          message.Rcpts.forEach(rcpt => {
            let localRcptUser = this.dataProvider.getPerson(rcpt.Uid);
            if (localRcptUser) {
              rcpt.ReceivingUser = localRcptUser.Fnm + ' ' + localRcptUser.Lnm;
            }
          });
        } else {
          message.Rcpts = new Array<MessageRecipientResult>();
        }

        return message;
      }));
  }

  public deleteMessage(messageId: any): Observable<Object> {
    const params = new HttpParams().append('messageId', messageId);

    return this.http.delete(environment.baseApiUrl + environment.resgridApiUrl + '/Messages/DeleteMessage', { params });
  }

  public setMessageResponse(messageId: any, type: any, note: string): Observable<Object> {
    const data = {
      Id: messageId,
      Typ: type,
      Not: note
    };

    return this.http.put(environment.baseApiUrl + environment.resgridApiUrl + '/Messages/RespondToMessage', data);
  }

  public sendMessage(subject: string, body: string, type: number, recipients: string): Observable<Object> {

    const data = {
      Ttl: subject,
      Bdy: body,
      Typ: type,
      Rcps: []
    };

    if (recipients && recipients.length > 0) {
      let items = recipients.split('|');

      items.forEach(item => {
        if (item == '0') {
          data.Rcps.push({
            Id: 0,
            Typ: 0,
            Nme: 'Everyone'
          });
        } else if (item.startsWith('P')) {
          data.Rcps.push({
            Id: item.replace('P:', ''),
            Typ: 1,
            Nme: ''
          });
        } else if (item.startsWith('G')) {
          data.Rcps.push({
            Id: item.replace('G:', ''),
            Typ: 2,
            Nme: ''
          });
        } else if (item.startsWith('R')) {
          data.Rcps.push({
            Id: item.replace('R:', ''),
            Typ: 3,
            Nme: ''
          });
        }
      });
    }

    return this.http.post(environment.baseApiUrl + environment.resgridApiUrl + '/Messages/SendMessage', data);
  }
}
