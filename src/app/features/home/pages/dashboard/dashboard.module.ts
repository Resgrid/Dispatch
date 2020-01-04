import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

import { DashboardPage } from './dashboard.page';
import { UnitListComponent } from '../../components/unitsList/units-list';
import { DigitalClockComponent } from '../../components/digital-clock/digital-clock.component';
import { CallsListComponent } from '../../components/calls-list/calls-list';
import { DirectivesModule } from 'src/app/directives/directives.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    DirectivesModule,
    RouterModule.forChild([
      {
        path: '',
        component: DashboardPage
      }
    ])
  ],
  declarations: [DashboardPage, UnitListComponent, DigitalClockComponent, CallsListComponent]
})
export class DashboardPageModule {}
