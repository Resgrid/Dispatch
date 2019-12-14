import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { APP_CONFIG_TOKEN, AppConfig } from '../config/app.config-interface';

import { DataProvider } from './data';

import { NoteResult } from '../models/noteResult';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NotesProvider {

  constructor(public http: HttpClient, @Inject(APP_CONFIG_TOKEN) private appConfig: AppConfig, private dataProvider: DataProvider) {
  }

  public getNotes(): Observable<NoteResult[]> {
    return this.http.get<NoteResult[]>(this.appConfig.ResgridApiUrl + '/Notes/GetAllNotes')
      .pipe(map((items) => {
        let notes: NoteResult[] = new Array<NoteResult>();

        items.forEach(item => {
          let message = item as NoteResult;

          const localUser = this.dataProvider.getPerson(item.Uid);
          if (localUser) {
            message.AddedBy = localUser.Fnm + ' ' + localUser.Lnm;
          }

          notes.push(message);
        });

        return notes;
      }));
  }

  public getNote(noteId: any): Observable<NoteResult> {
    const params = new HttpParams().append('noteId', noteId);

    return this.http.get<NoteResult>(this.appConfig.ResgridApiUrl + '/Notes/GetNote', { params })
      .pipe(map((item) => {
        let note: NoteResult = item as NoteResult;

        const localUser = this.dataProvider.getPerson(item.Uid);
        if (localUser) {
          note.AddedBy = localUser.Fnm + ' ' + localUser.Lnm;
        }

        return note;
      }));
  }

  public saveNote(title: string, body: string): Observable<Object> {

    const data = {
      Ttl: title,
      Bdy: body,
      Cat: null,  // Category
      Ado: false  // Admins Only
    };

    return this.http.post(this.appConfig.ResgridApiUrl + '/Notes/SaveNote', data);
  }
}
