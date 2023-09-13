import { Component, Input, OnInit } from "@angular/core";
import { NgbModal, NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { Store } from "@ngrx/store";
import { Observable } from "rxjs";
import { selectHomeState, selectIsSavingUnitState } from "src/app/store";
import { HomeState } from "../../store/home.store";
import * as HomeActions from "../../actions/home.actions";
import { take } from "rxjs/operators";
import { Actions, ofType } from "@ngrx/effects";
import { CallResultData, CustomStatesService, CustomStatusResultData, GroupResultData } from "@resgrid/ngx-resgridlib";

@Component({
  selector: "app-resgrid-modal-setPersonStatus",
  templateUrl: "setPersonStatus.modal.html",
  styleUrls: ["setPersonStatus.modal.scss"],
})
export class SetPersonStatusModalComponent implements OnInit {
  public homeState$: Observable<HomeState | null>;

  public selectedStatus: CustomStatusResultData;

  public selectedCall: CallResultData;
  public selectedStation: GroupResultData;
  public selectedDestination: any;
  public note: string;
  public isSaving: boolean = false;

  constructor(
    public activeModal: NgbActiveModal,
    private store: Store<HomeState>,
    private actions$: Actions,
    private customStatesService: CustomStatesService,
  ) {
    this.homeState$ = this.store.select(selectHomeState);
  }

  ngOnInit() {}

  public dismiss() {
    this.activeModal.close();
  }

  public save() {
    if (this.selectedStatus) {
      this.isSaving = true;
      //this.store.dispatch(new HomeActions.SavingSetUnitState());

      this.store
        .select(selectHomeState)
        .pipe(take(1))
        .subscribe((state) => {
          var destination = "0";
          var destinationType = 0;

          if (this.selectedStatus?.Detail === 1) {
            if (this.selectedStation) {
              destination = this.selectedStation.GroupId.toString();
              destinationType = 1;
            }
          } else if (this.selectedStatus?.Detail === 2) {
            if (this.selectedCall) {
              destination = this.selectedCall.CallId;
              destinationType = 2;
            }
          } else if (this.selectedStatus?.Detail === 3) {
            if (this.selectedDestination) {
              destination = this.selectedDestination.id;
              destinationType = this.selectedDestination.type;
            }
          }

          var userIds: string[] = [];
          state.personnelForGrid.forEach((person) => {
            if (person.Selected) {
              userIds.push(person.UserId);
            }
          });

          const setUnitStatusData = {
            userIds: userIds,
            stateType: this.selectedStatus.Id,
            destination: destination,
            destinationType: destinationType,
            note: this.note,
            date: new Date(),
          };

          this.store.dispatch(new HomeActions.SavingPersonStatuses(setUnitStatusData));
        });
    }
  }
}
