import { Injectable, Inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

import { DataProvider } from './data';

import { NoteResult } from '../core/models/noteResult';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class NotesProvider {

  constructor(public http: HttpClient, private dataProvider: DataProvider) {
  }

  public getNotes(): Observable<NoteResult[]> {
    return this.http.get<NoteResult[]>(environment.baseApiUrl + environment.resgridApiUrl + '/Notes/GetAllNotes')
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

    return this.http.get<NoteResult>(environment.baseApiUrl + environment.resgridApiUrl + '/Notes/GetNote', { params })
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

    return this.http.post(environment.baseApiUrl + environment.resgridApiUrl + '/Notes/SaveNote', data);
  }
}
