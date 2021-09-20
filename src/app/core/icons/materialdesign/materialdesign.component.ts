import { Component, OnInit } from '@angular/core';

import { icons } from './data';

@Component({
  selector: 'app-materialdesign',
  templateUrl: './materialdesign.component.html',
  styleUrls: ['./materialdesign.component.scss']
})

/**
 * Material design component
 */
export class MaterialdesignComponent implements OnInit {
  // bread crumb items
  breadCrumbItems: Array<{}>;
  icons: Array<{}>;
  iconsCount = 0;
  newIconsCount = 0;
  constructor() { }

  ngOnInit() {
    this.breadCrumbItems = [{ label: 'Icons' }, { label: 'MD Icons', active: true }];

    this.icons = icons;
    this.icons.push({ name: 'blank', hex: 'f68c' });

    this.icons.forEach(icon => {
      const item = this.getIconItem(icon, this.isNew(icon));
      document.getElementById('icons').appendChild(item);
      if (this.isNew(icon)) {
        const newItem = this.getIconItem(icon, false);
        document.getElementById('newIcons').appendChild(newItem);
        this.newIconsCount++;
      }
      this.iconsCount++;
    });
  }

  isNew(icon) {
    return icon.version === '5.0.45';
  }

  getIconItem(icon, isNewIcon) {
    // tslint:disable-next-line: one-variable-per-declaration
    const div = document.createElement('div'),
      i = document.createElement('i');
    div.className = 'col-xl-3 col-lg-4 col-sm-6';
    i.className = 'mdi mdi-' + icon.name;
    div.appendChild(i);
    const span = document.createElement('span');
    span.appendChild(document.createTextNode('mdi-' + icon.name));
    div.appendChild(span);
    return div;
  }

  isDeprecated(icon) {
    return typeof icon.deprecated === 'undefined'
      ? false
      : icon.deprecated;
  }
}
