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

@Component({
  selector: "app-resgrid-modal-setUnitStatus",
  templateUrl: "setUnitStatus.modal.html",
  styleUrls: ["setUnitStatus.modal.scss"],
})
export class SetUnitStatusModalComponent implements OnInit {
  public homeState$: Observable<HomeState | null>;
  public selectedStatus: CustomStatusesResult;
  public selectedCall: CallResult;
  public selectedStation: GroupInfo;
  public selectedDestination: any;
  public note: string;
  public isSaving: boolean = false;

  constructor(
    public activeModal: NgbActiveModal,
    private store: Store<HomeState>,
    private actions$: Actions
  ) {
    this.homeState$ = this.store.select(selectHomeState);
  }

  ngOnInit() {}

  public dismiss() {
    this.activeModal.close();
  }

  public save() {
    if (this.selectedStatus && this.selectedStatus.Id >= 0) {
      this.isSaving = true;
      this.store.dispatch(new HomeActions.SavingSetUnitState());

      this.store
        .select(selectHomeState)
        .pipe(take(1))
        .subscribe((state) => {
          var destination = "0";
          var destinationType = 0;

          if (this.selectedStatus?.Detail === 1) {
            if (this.selectedStation) {
              destination = this.selectedStation.Gid.toString();
              destinationType = 1;
            }
          } else if (this.selectedStatus?.Detail === 2) {
            if (this.selectedCall) {
              destination = this.selectedCall.Cid;
              destinationType = 2;
            }
          } else if (this.selectedStatus?.Detail === 3) {
            if (this.selectedDestination) {
              destination = this.selectedDestination.id;
              destinationType = this.selectedDestination.type;
            }
          }

          const setUnitStatusData = {
            unitId: state.setUnitStatusModalState.UnitId,
            stateType: this.selectedStatus.Id,
            destination: destination,
            destinationType: destinationType,
            note: this.note,
            date: new Date()
          };

          this.store.dispatch(new HomeActions.SavingUnitState(setUnitStatusData));
        });
    }
  }
}
