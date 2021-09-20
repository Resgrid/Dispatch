import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { SharedModule } from './shared/shared.module';

import { VerticalComponent } from './vertical/vertical.component';
import { LayoutComponent } from './layout/layout.component';
import { VoiceModule } from '../features/voice/voice.module';
import { NgxSpinnerModule } from 'ngx-spinner';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

@NgModule({
  declarations: [VerticalComponent, LayoutComponent],
  imports: [
    CommonModule,
    SharedModule,
    RouterModule,
    VoiceModule,
    BrowserAnimationsModule,
    NgxSpinnerModule,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  exports: [VerticalComponent]
})
export class LayoutsModule { }
