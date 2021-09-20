import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { StatComponent } from './stat/stat.component';

import { NgbTypeaheadModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  declarations: [StatComponent],
  imports: [
    CommonModule,
    FormsModule,
    NgbTypeaheadModule,
    NgbPaginationModule
  ],
  exports: [StatComponent]
})
export class WidgetModule { }
