import * as mapAction from '../actions/map.actions';
import { Action } from '@ngrx/store';
import { Actions, Effect, ofType } from '@ngrx/effects';
import { catchError, map, mergeMap, tap } from 'rxjs/operators';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { MapProvider } from '../../../providers/map';

@Injectable()
export class MapEffects {
  @Effect()
  loading$: Observable<Action> = this
    .actions$
    .pipe(ofType<mapAction.Loading>(mapAction.MapActionTypes.LOADING),
      mergeMap(action => this.mapProvider.getMapData().pipe(
        // If successful, dispatch success action with result
        map(data => ({
          type: mapAction.MapActionTypes.LOADING_SUCCESS,
          payload: data
        })),
        // If request fails, dispatch failed action
        catchError(() => of({ type: mapAction.MapActionTypes.LOADING_FAIL })))));

  constructor(private actions$: Actions, private mapProvider: MapProvider) { }
}
