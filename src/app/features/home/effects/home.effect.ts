import * as homeAction from '../actions/home.actions';
import { Action } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, tap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { CallsProvider } from 'src/app/providers/calls';
import { HomeProvider } from '../providers/home';

@Injectable()
export class HomeEffects {
  @Effect()
  loading$: Observable<Action> = this
    .actions$
    .pipe(ofType<homeAction.Loading>(homeAction.HomeActionTypes.LOADING),
      mergeMap(action => this.homeProvider.getHomeData().pipe(
        // If successful, dispatch success action with result
        map(data => ({
          type: homeAction.HomeActionTypes.LOADING_SUCCESS,
          payload: data
        })),
        // If request fails, dispatch failed action
        catchError(() => of({ type: homeAction.HomeActionTypes.LOADING_FAIL })))));

  constructor(private actions$: Actions, private homeProvider: HomeProvider) { }
}
