import { Subscription, timer, Observable } from 'rxjs';
import { Component, OnInit, OnDestroy, Input, ViewChild } from '@angular/core';

import leaflet from 'leaflet';
import L from 'leaflet';
import { Store } from '@ngrx/store';
import { MapState } from '../../store/map.store';
import { selectMapState } from 'src/app/store';
import * as NewCallActions from '../../actions/new-call.actions';
import { take } from 'rxjs/operators';
import { MapResult } from 'src/app/models/mapResult';

@Component({
  selector: 'app-new-call',
  templateUrl: './new-call.component.html',
  styleUrls: ['./new-call.component.scss']
})
export class NewCallComponent implements OnInit, OnDestroy {
  public mapState$: Observable<MapState | null>;

  constructor(private store: Store<MapState>) {
    this.mapState$ = this.store.select(selectMapState);
  }

  public ngOnInit() {
    this.mapState$
      //.pipe(take(1))
      .subscribe((data: MapState) => {
        
      });

    this.store.dispatch(new MapActions.Loading());
  }

  public ngOnDestroy(): void {

  }

}
