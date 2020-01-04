import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HomeRoutingModule } from './home-routing.module';
import { reducer } from './reducers/home.reducer';
import { HomeEffects } from './effects/home.effect';
import { UnitListComponent } from './components/unitsList/units-list';
import { IonicModule } from '@ionic/angular';
import { ComponentsModule } from 'src/app/components/components.module';
import { DirectivesModule } from 'src/app/directives/directives.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReactiveFormsModule,
    HomeRoutingModule,
    DirectivesModule,
    StoreModule.forFeature('homeModule', reducer),
    EffectsModule.forFeature([HomeEffects]),
  ],
  providers: []
})
export class HomeModule { }
