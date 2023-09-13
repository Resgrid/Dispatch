import { Store } from "@ngrx/store";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import { catchError, map, mergeMap } from "rxjs/operators";
import { Injectable } from "@angular/core";
import { from, of } from "rxjs";
import { NgbModal, NgbModalRef } from "@ng-bootstrap/ng-bootstrap";
import { MappingService } from "@resgrid/ngx-resgridlib";
import * as _ from "lodash";
import * as mappingAction from "../actions/mapping.actions";
import { MappingState } from "../store/mapping.store";

@Injectable()
export class MappingEffects {
  private _modalRef: NgbModalRef;

  getUnitsList$ = createEffect(() =>
    this.actions$.pipe(
      ofType<mappingAction.LoadMapData>(mappingAction.MappingActionTypes.LOADING_MAP_DATA),
      mergeMap((action) =>
        this.mapProvider.getMapDataAndMarkers().pipe(
          map((data) => ({
            type: mappingAction.MappingActionTypes.LOADING_MAP_DATA_SUCCESS,
            payload: data.Data,
          })),
          catchError(() =>
            of({
              type: mappingAction.MappingActionTypes.LOADING_MAP_DATA_FAIL,
            }),
          ),
        ),
      ),
    ),
  );

  constructor(
    private actions$: Actions,
    private store: Store<MappingState>,
    private modalService: NgbModal,
    private mapProvider: MappingService,
  ) {}

  runModal = (component, size) => {
    this.closeModal();

    if (!size) {
      size = "md";
    }

    this._modalRef = this.modalService.open(component, {
      centered: true,
      backdrop: "static",
      size: size,
    });

    return from(this._modalRef.result);
  };

  closeModal = () => {
    if (this._modalRef) {
      this._modalRef.close();
      this._modalRef = null;
    }
  };
}
