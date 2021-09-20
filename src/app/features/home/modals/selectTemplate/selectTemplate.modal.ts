import { Component, Input, OnInit } from "@angular/core";
import { NgbModal, NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { Store } from "@ngrx/store";
import { Observable } from "rxjs";
import { CallResult } from "src/app/core/models/callResult";
import { CustomStatusesResult } from "src/app/core/models/customStatusesResult";
import { GroupInfo } from "src/app/core/models/groupInfo";
import { selectHomeState, selectIsSavingUnitState } from "src/app/store";
import { HomeState } from "../../store/home.store";
import * as HomeActions from "../../actions/home.actions";
import { take } from "rxjs/operators";
import { Actions, ofType } from "@ngrx/effects";
import * as _ from 'lodash';
import { CallTemplateResult } from "src/app/core/models/callTemplate";

@Component({
  selector: "app-resgrid-modal-selectTemplate",
  templateUrl: "selectTemplate.modal.html",
  styleUrls: ["selectTemplate.modal.scss"],
})
export class SelectTemplateModalComponent implements OnInit {
  public homeState$: Observable<HomeState | null>;
  public isSaving: boolean = false;
  public selectedCallTemplate: CallTemplateResult;

  constructor(
    public activeModal: NgbActiveModal,
    private store: Store<HomeState>,
    private actions$: Actions
  ) {
    this.homeState$ = this.store.select(selectHomeState);
  }

  ngOnInit() {

  }

  public dismiss() {
    this.activeModal.close();
  }

  public save() {
    this.isSaving = true;

    this.store.dispatch(new HomeActions.ApplyCallTemplate(this.selectedCallTemplate));
  }
}
