import { NgModule } from "@angular/core";
import { StoreModule } from "@ngrx/store";
import { EffectsModule } from "@ngrx/effects";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormsModule } from "@angular/forms";
import { reducer } from "./reducers/profile.reducer";
import { ProfileEffects } from "./effects/profile.effect";
import {
  NgbAlertModule,
  NgbDropdownModule,
  NgbNavModule,
  NgbPaginationModule,
  NgbTooltipModule,
  NgbTypeaheadModule,
} from "@ng-bootstrap/ng-bootstrap";
import { Ng2SearchPipeModule } from "ng2-search-filter";
import { PerfectScrollbarModule } from "ngx-perfect-scrollbar";
import { LeafletModule } from "@asymmetrik/ngx-leaflet";
import { UiModule } from "src/app/shared/ui/ui.module";
import { GalleryModule } from "ng-gallery";
import { NgxResgridLibModule } from "@resgrid/ngx-resgridlib";
import { ProfileRoutingModule } from "./profile-routing.module";

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ProfileRoutingModule,
    NgbAlertModule,
    NgxResgridLibModule,
    Ng2SearchPipeModule,
    NgbNavModule,
    NgbDropdownModule,
    NgbTooltipModule,
    PerfectScrollbarModule,
    LeafletModule,
    UiModule,
    StoreModule.forFeature("profileModule", reducer),
    EffectsModule.forFeature([ProfileEffects]),
    GalleryModule,
    NgbPaginationModule,
    NgbTypeaheadModule,
  ],
  providers: [],
  exports: [],
})
export class ProfileModule {}
