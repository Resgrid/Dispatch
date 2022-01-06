import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HomeRoutingModule } from './home-routing.module';
import { reducer } from './reducers/home.reducer';
import { HomeEffects } from './effects/home.effect';
import { NgbAlertModule, NgbDropdownModule, NgbNavModule, NgbPaginationModule, NgbTooltipModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { Ng2SearchPipeModule } from 'ng2-search-filter';
import { PerfectScrollbarModule } from 'ngx-perfect-scrollbar';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { UiModule } from 'src/app/shared/ui/ui.module';
import { SetUnitStatusModalComponent } from './modals/setUnitStatus/setUnitStatus.modal';
import { CloseCallModalComponent } from './modals/closeCall/closeCall.modal';
import { SelectTemplateModalComponent } from './modals/selectTemplate/selectTemplate.modal';
import { CallNotesModalComponent } from './modals/callNotes/callNotes.modal';
import { GalleryModule } from  'ng-gallery';
import { CallImagesModalComponent } from './modals/callImages/callImages.modal';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CallFilesModalComponent } from './modals/callFiles/callFiles.modal';
import { CallFormModalComponent } from './modals/callForm/callForm.modal';
import { NgxResgridLibModule } from '@resgrid-shared/ngx-resgridlib';

@NgModule({
  declarations: [
    SetUnitStatusModalComponent,
    CloseCallModalComponent,
    SelectTemplateModalComponent,
    CallNotesModalComponent,
    CallImagesModalComponent,
    CallFilesModalComponent,
    CallFormModalComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HomeRoutingModule,
    NgxResgridLibModule,
    NgbAlertModule,
    Ng2SearchPipeModule,
    NgbNavModule,
    NgbDropdownModule,
    NgbTooltipModule,
    PerfectScrollbarModule,
    LeafletModule,
    UiModule,
    StoreModule.forFeature('homeModule', reducer),
    EffectsModule.forFeature([HomeEffects]),
    GalleryModule,
    NgbPaginationModule,
    NgbTypeaheadModule
  ],
  providers: [],
  entryComponents: [
    SetUnitStatusModalComponent,
    CloseCallModalComponent,
    SelectTemplateModalComponent,
    CallNotesModalComponent,
    CallImagesModalComponent,
    CallFilesModalComponent,
    CallFormModalComponent
  ]
})
export class HomeModule { }
