import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CallsRoutingModule } from './calls-routing.module';
import { reducer } from './reducers/calls.reducer';
import { CallsEffects } from './effects/calls.effect';
import { DirectivesModule } from 'src/app/directives/directives.module';
import { NgbAlertModule, NgbDropdownModule, NgbNavModule, NgbPaginationModule, NgbTooltipModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { Ng2SearchPipeModule } from 'ng2-search-filter';
import { PerfectScrollbarModule } from 'ngx-perfect-scrollbar';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { UiModule } from 'src/app/shared/ui/ui.module';
import { GalleryModule } from  'ng-gallery';
import { UpdateDispatchTimeModalComponent } from './modals/updateDispatchTime/updateDispatchTime.modal';

@NgModule({
  declarations: [
    UpdateDispatchTimeModalComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CallsRoutingModule,
    DirectivesModule,
    NgbAlertModule,
    Ng2SearchPipeModule,
    NgbNavModule,
    NgbDropdownModule,
    NgbTooltipModule,
    PerfectScrollbarModule,
    LeafletModule,
    UiModule,
    StoreModule.forFeature('callsModule', reducer),
    EffectsModule.forFeature([CallsEffects]),
    GalleryModule,
    NgbPaginationModule,
    NgbTypeaheadModule
  ],
  providers: [],
  exports: [
    
  ],
  entryComponents: [
    UpdateDispatchTimeModalComponent
  ]
})
export class CallsModule { }
