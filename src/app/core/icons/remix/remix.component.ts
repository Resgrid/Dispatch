import { Component, OnInit } from '@angular/core';

import { icons } from './data';

@Component({
  selector: 'app-remix',
  templateUrl: './remix.component.html',
  styleUrls: ['./remix.component.scss']
})
export class RemixComponent implements OnInit {
  // bread crumb items
  breadCrumbItems: Array<{}>;

  icons: any;
  iconData: any;

  constructor() { }

  ngOnInit(): void {
    this.breadCrumbItems = [{ label: 'Icons' }, { label: 'Remix Icons', active: true }];
    this.icons = JSON.parse(icons);
    this.iconData = '';
    for (const [key, value] of Object.entries(this.icons)) {
      if (`${key}` === 'Editor') {
        // tslint:disable-next-line: max-line-length
        this.iconData = this.iconData + '<div class="card"><div class="card-body"><h4 class="card-title">' + key + ' </h4><p class="card-title-desc mb-2">Use <code>&lt;i class="ri-bold"&gt;&lt;/i&gt;</code> <span class="badge badge-success">v 2.4.1</span>.</p><div class="row icon-demo-content">';
        for (const k of Object.entries(value)) {
          this.iconData +=
            '<div class="col-xl-3 col-lg-4 col-sm-6">\
                    <i class="ri-' +
            k[0] +
            '"></i> ri-' +
            k[0] +
            '</div>';
        }
      } else {
        // tslint:disable-next-line: max-line-length
        this.iconData = this.iconData + '<div class="card"><div class="card-body"><h4 class="card-title">' + key + ' </h4><p class="card-title-desc mb-2">Use <code>&lt;i class="ri-home-line"&gt;&lt;/i&gt;</code> or <code>&lt;i class="ri-home-fill"&gt;&lt;/i&gt;</code> <span class="badge badge-success">v 2.4.1</span>.</p><div class="row icon-demo-content">';
        for (const k of Object.entries(value)) {
          this.iconData += '<div class="col-xl-3 col-lg-4 col-sm-6">\
            <i class="ri-' + k[0] + '-line"></i> ri-' + k[0] + '-line\
        </div><div class="col-xl-3 col-lg-4 col-sm-6">\
            <i class="ri-' + k[0] + '-fill"></i> ri-' + k[0] + '-fill\
        </div>';
        }
      }
      this.iconData += '</div></div></div>';
    }
    document.getElementById('icons').innerHTML = this.iconData;
  }
}

