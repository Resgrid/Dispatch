import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-dripicons',
  templateUrl: './dripicons.component.html',
  styleUrls: ['./dripicons.component.scss']
})

/**
 * Dripicons component
 */
export class DripiconsComponent implements OnInit {
  // bread crumb items
  breadCrumbItems: Array<{}>;

  constructor() { }

  ngOnInit() {
    this.breadCrumbItems = [{ label: 'Icons' }, { label: 'Dripicons', active: true }];
  }
}
