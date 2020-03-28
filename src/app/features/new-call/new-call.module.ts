import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MapRoutingModule } from './map-routing.module';
import { reducer } from './reducers/map.reducer';
import { MapEffects } from './effects/map.effect';
import { MapComponent } from './components/map/map.component';
import { IonicModule } from '@ionic/angular';
import { ComponentsModule } from 'src/app/components/components.module';
import { DirectivesModule } from 'src/app/directives/directives.module';

@NgModule({
  declarations: [MapComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReactiveFormsModule,
    MapRoutingModule,
    DirectivesModule,
    StoreModule.forFeature('mapModule', reducer),
    EffectsModule.forFeature([MapEffects]),
  ],
  providers: [],
  exports: [MapComponent]
})
export class NewCallModule { }
