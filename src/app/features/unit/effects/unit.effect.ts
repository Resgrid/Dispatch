import * as unitAction from '../actions/unit.actions';
import { Action } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { CallsProvider } from 'src/app/providers/calls';
import { HomeProvider } from '../providers/home';

@Injectable()
export class UnitEffects {
  @Effect()
  setStatus$: Observable<Action> = this
    .actions$
    .pipe(ofType<unitAction.SetStatus>(unitAction.UnitActionTypes.SET_STATUS),
      mergeMap(action => this.homeProvider.getHomeData().pipe(
        // If successful, dispatch success action with result
        map(data => ({
          type: unitAction.UnitActionTypes.SET_STATUS_SUCCESS,
          payload: data
        })),
        // If request fails, dispatch failed action
        catchError(() => of({ type: unitAction.UnitActionTypes.SET_STATUS_FAIL })))));

  constructor(private actions$: Actions, private homeProvider: HomeProvider) { }
}
