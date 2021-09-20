import { Component, OnInit } from '@angular/core';

import { icons } from './data';

@Component({
  selector: 'app-fontawesome',
  templateUrl: './fontawesome.component.html',
  styleUrls: ['./fontawesome.component.scss']
})

/**
 * Font awesome component
 */
export class FontawesomeComponent implements OnInit {
  // bread crumb items
  breadCrumbItems: Array<{}>;

  icons;

  solid = '';
  regular = '';
  brand = '';

  constructor() { }

  ngOnInit() {
    this.breadCrumbItems = [{ label: 'Icons' }, { label: 'Font awesome 5', active: true }];

    this.icons = icons;

    for (const entry of icons) {
      if (entry.attributes.membership.free.length) {
        for (const value of entry.attributes.membership.free) {
          switch (value) {
            case 'brands':
              this.brand += '<div class="col-xl-3 col-lg-4 col-sm-6">\
                          <i class="fab fa-' + entry.id + '"></i> fab fa-' + entry.id + '\
                      </div>';
              break;
            case 'solid':
              this.solid += '<div class="col-xl-3 col-lg-4 col-sm-6">\
                    <i class="fas fa-' + entry.id + '"></i> fas fa-' + entry.id + '\
                </div>';
              break;
            default:
              this.regular += '<div class="col-xl-3 col-lg-4 col-sm-6">\
                          <i class="far fa-' + entry.id + '"></i> far fa-' + entry.id + '\
                      </div>';
          }
        }
      }
    }

    document.getElementById('solid').innerHTML = this.solid;
    document.getElementById('brand').innerHTML = this.brand;
    document.getElementById('regular').innerHTML = this.regular;
  }
}
