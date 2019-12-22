import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { HomeState } from '../../store/home.store';
import { Observable } from 'rxjs';
import { selectHomeState } from 'src/app/store';
import * as HomeActions from '../../actions/home.actions';

@Component({
  selector: 'app-dashboard',
  templateUrl: 'dashboard.page.html',
  styleUrls: ['dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  public homeState$: Observable<HomeState | null>;

  constructor(private store: Store<HomeState>) {
    this.homeState$ = this.store.select(selectHomeState);
  }

  public ngOnInit() {
    this.store.dispatch(new HomeActions.Loading());
  }


}
