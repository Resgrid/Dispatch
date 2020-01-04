import { Component, OnInit, Input } from '@angular/core';
import { HomeState } from '../../store/home.store';
import { _ } from 'underscore';

@Component({
  selector: 'app-units-list',
  templateUrl: './units-list.html',
  styleUrls: ['./units-list.scss'],
})
export class UnitListComponent implements OnInit {
  @Input() state: HomeState;
  data: any;

  constructor() { }

  ionViewWillEnter() {
    setTimeout(() => {
      this.data = {
        'heading': 'Normal text',
        'para1': 'Lorem ipsum dolor sit amet, consectetur',
        'para2': 'adipiscing elit.'
      };
    }, 5000);
  }

  ngOnInit() {

  }

  public getUnits() {
    if (this.state && this.state.data && this.state.data.UnitStatuses) {
      //const groupedUnits = _.groupBy(this.state.data.Units, 'StationName');
      //const groupedUnits = _.chain(this.state.data.Units).groupBy('StationName').pairs().sortBy(0).value();
      //console.log(JSON.stringify(groupedUnits));
      //return groupedUnits;

    }
  }
}
