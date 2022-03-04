import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Ng2SearchPipeModule } from 'ng2-search-filter';
import { EditCallPage } from './edit-call.page';
import { NgbAlertModule, NgbDropdownModule, NgbNavModule, NgbPaginationModule, NgbTooltipModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { PerfectScrollbarConfigInterface, PerfectScrollbarModule, PERFECT_SCROLLBAR_CONFIG } from 'ngx-perfect-scrollbar';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { UiModule } from 'src/app/shared/ui/ui.module';
import { NgxResgridLibModule } from '@resgrid/ngx-resgridlib';

const DEFAULT_PERFECT_SCROLLBAR_CONFIG: PerfectScrollbarConfigInterface = {
  suppressScrollX: true,
  wheelSpeed: 0.3
};

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    NgbAlertModule,
    ReactiveFormsModule,
    Ng2SearchPipeModule,
    NgxResgridLibModule,
    NgbNavModule,
    NgbDropdownModule,
    NgbTooltipModule,
    PerfectScrollbarModule,
    LeafletModule,
    UiModule,
    NgbPaginationModule,
    NgbTypeaheadModule,
    RouterModule.forChild([
      {
        path: '',
        component: EditCallPage
      }
    ])
  ],
  providers: [
    {
      provide: PERFECT_SCROLLBAR_CONFIG,
      useValue: DEFAULT_PERFECT_SCROLLBAR_CONFIG
    }
  ],
  declarations: [EditCallPage]
})
export class EditCallPageModule {}
