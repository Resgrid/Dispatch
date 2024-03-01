import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { VoiceRoutingModule } from './voice-routing.module';
import { reducer } from './reducers/voice.reducer';
import { VoiceEffects } from './effects/voice.effect';
import { NgbAlertModule, NgbDropdownModule, NgbNavModule, NgbPaginationModule, NgbTooltipModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { Ng2SearchPipeModule } from 'ng2-search-filter';
import { PerfectScrollbarModule } from 'ngx-perfect-scrollbar';
import { LeafletModule } from '@asymmetrik/ngx-leaflet';
import { UiModule } from 'src/app/shared/ui/ui.module';
import { GalleryModule } from  'ng-gallery';
import { VoiceFooterComponent } from './shared/voice-footer/voice-footer.component';
import { OpenViduVideoComponent } from './shared/video-component/ov-video.component';
import { NgxResgridLibModule } from '@resgrid/ngx-resgridlib';

@NgModule({
    declarations: [
        VoiceFooterComponent,
        OpenViduVideoComponent
    ],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        VoiceRoutingModule,
        NgbAlertModule,
        Ng2SearchPipeModule,
        NgbNavModule,
        NgbDropdownModule,
        NgbTooltipModule,
        PerfectScrollbarModule,
        LeafletModule,
        UiModule,
        StoreModule.forFeature('voiceModule', reducer),
        EffectsModule.forFeature([VoiceEffects]),
        GalleryModule,
        NgbPaginationModule,
        NgbTypeaheadModule,
        NgxResgridLibModule
    ],
    providers: [],
    exports: [
        VoiceFooterComponent,
        OpenViduVideoComponent
    ]
})
export class VoiceModule { }
