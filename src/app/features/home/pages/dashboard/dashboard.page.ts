import { Component } from '@angular/core';
import { Store } from '@ngrx/store';
import { HomeState } from '../../store/home.store';

@Component({
  selector: 'app-dashboard',
  templateUrl: 'dashboard.page.html',
  styleUrls: ['dashboard.page.scss'],
})
export class DashboardPage {

  constructor(private store: Store<HomeState>) {}

}
