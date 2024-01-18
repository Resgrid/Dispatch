import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CallsRoutingModule } from './mapping-routing.module';
import { reducer } from './reducers/mapping.reducer';
import { MappingEffects } from './effects/mapping.effect';
import { NgbAlertModule, NgbDropdownModule, NgbNavModule, NgbPaginationModule, NgbTooltipModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { Ng2SearchPipeModule } from 'ng2-search-filter';
import { PerfectScrollbarModule } from 'ngx-perfect-scrollbar';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { UiModule } from 'src/app/shared/ui/ui.module';
import { GalleryModule } from  'ng-gallery';
import { NgxResgridLibModule } from '@resgrid/ngx-resgridlib';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        CallsRoutingModule,
        NgbAlertModule,
        NgxResgridLibModule,
        Ng2SearchPipeModule,
        NgbNavModule,
        NgbDropdownModule,
        NgbTooltipModule,
        PerfectScrollbarModule,
        LeafletModule,
        UiModule,
        StoreModule.forFeature('mappingModule', reducer),
        EffectsModule.forFeature([MappingEffects]),
        GalleryModule,
        NgbPaginationModule,
        NgbTypeaheadModule
    ],
    providers: [],
    exports: []
})
export class MappingModule { }
