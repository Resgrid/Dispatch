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

@Component({
  selector: "app-resgrid-modal-closeCall",
  templateUrl: "closeCall.modal.html",
  styleUrls: ["closeCall.modal.scss"],
})
export class CloseCallModalComponent implements OnInit {
  public homeState$: Observable<HomeState | null>;
  public selectedCallStatus: string = "1";
  public selectedCall: CallResult;
  public note: string;
  public isSaving: boolean = false;

  constructor(
    public activeModal: NgbActiveModal,
    private store: Store<HomeState>,
    private actions$: Actions
  ) {
    this.homeState$ = this.store.select(selectHomeState);
  }

  ngOnInit() {
    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        this.selectedCall = _.find(state.calls, ['Selected', true]);
      });
  }

  public dismiss() {
    this.activeModal.close();
  }

  public save() {
    this.isSaving = true;

    const saveCallCloseData = {
      callId: this.selectedCall.Cid,
      stateType: this.selectedCallStatus,
      note: this.note,
      date: new Date(),
    };

    this.store.dispatch(new HomeActions.SavingCloseCall(saveCallCloseData));
  }
}
