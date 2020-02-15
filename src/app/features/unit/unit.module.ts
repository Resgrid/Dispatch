import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { UnitEffects } from './effects/unit.effect';
import { reducer } from './reducers/unit.reducer';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { UnitRoutingModule } from './unit-routing.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    UnitRoutingModule,
    StoreModule.forFeature('unitModule', reducer),
    EffectsModule.forFeature([UnitEffects]),
  ],
  providers: []
})
export class AuthModule { }
