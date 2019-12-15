import { NgModule } from '@angular/core';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HomeRoutingModule } from './home-routing.module';
import { reducer } from './reducers/home.reducer';
import { HomeEffects } from './effects/home.effect';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HomeRoutingModule,
    StoreModule.forFeature('homeModule', reducer),
    EffectsModule.forFeature([HomeEffects]),
  ],
  providers: []
})
export class HomeModule { }
