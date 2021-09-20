import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IconsRoutingModule } from './icons-routing.module';
import { UiModule } from '../../shared/ui/ui.module';

import { MaterialdesignComponent } from './materialdesign/materialdesign.component';
import { DripiconsComponent } from './dripicons/dripicons.component';
import { FontawesomeComponent } from './fontawesome/fontawesome.component';
import { RemixComponent } from './remix/remix.component';

@NgModule({
  declarations: [MaterialdesignComponent, DripiconsComponent, FontawesomeComponent, RemixComponent],
  imports: [
    CommonModule,
    IconsRoutingModule,
    UiModule
  ]
})
export class IconsModule { }
