import { Component, Input, OnInit } from "@angular/core";
import { NgbModal, NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { Store } from "@ngrx/store";
import { Observable, Subscription } from "rxjs";
import { selectAuthState, selectHomeState, selectIsSavingUnitState } from "src/app/store";
import { HomeState } from "../../store/home.store";
import * as HomeActions from "../../actions/home.actions";
import { take } from "rxjs/operators";
import { Actions, ofType } from "@ngrx/effects";
import * as _ from "lodash";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { environment } from "../../../../../environments/environment";
import { AuthState } from "src/app/features/auth/store/auth.store";
import { encode } from "base64-arraybuffer";
import { CallResultData } from "@resgrid/ngx-resgridlib";

@Component({
  selector: "app-resgrid-modal-callFiles",
  templateUrl: "callFiles.modal.html",
  styleUrls: ["callFiles.modal.scss"],
})
export class CallFilesModalComponent implements OnInit {
  public homeState$: Observable<HomeState | null>;
  public selectedCallStatus: string = "1";
  public selectedCall: CallResultData;
  public note: string;
  public isSaving: boolean = false;
  @Input() auth: AuthState;
  public formData: FormGroup;
  public searchTerm: string;
  public fileName = "";
  public uploadProgress: number;
  public uploadSub: Subscription;

  constructor(
    public activeModal: NgbActiveModal,
    private store: Store<HomeState>,
    private actions$: Actions,
    public formBuilder: FormBuilder,
    private authStore: Store<AuthState>,
  ) {
    this.homeState$ = this.store.select(selectHomeState);

    this.formData = this.formBuilder.group({
      message: ["", [Validators.required]],
    });
  }

  ngOnInit() {
    this.authStore
      .select(selectAuthState)
      .pipe(take(1))
      .subscribe((s) => (this.auth = s));

    this.store
      .select(selectHomeState)
      .pipe(take(1))
      .subscribe((state) => {
        this.selectedCall = _.find(state.calls, ["Selected", true]);
      });
  }

  public get form() {
    return this.formData.controls;
  }

  public getAvatarUrl(userId) {
    return environment.baseApiUrl + environment.resgridApiUrl + "/Avatars/Get?id=" + userId;
  }

  public dismiss() {
    this.activeModal.close();
  }

  public onFileSelected(event) {
    const file: File = event.target.files[0];

    if (file) {
      this.fileName = file.name;
      var enc = new TextDecoder("utf-8");

      this.isSaving = true;

      this.getBase64EncodedFileData(file).subscribe((base64Encoded) => {
        this.store.dispatch(new HomeActions.UploadCallFile(this.selectedCall.CallId, this.auth.user.userId, this.fileName, base64Encoded));
      });
    }
  }

  getBase64EncodedFileData(file: File): Observable<string> {
    return new Observable((observer) => {
      const reader = new FileReader();

      reader.onload = () => {
        const { result } = reader;
        const data = result as ArrayBuffer; // <--- FileReader gives us the ArrayBuffer
        const base64Encoded = encode(data); // <--- convert ArrayBuffer to base64 string

        observer.next(base64Encoded);
        observer.complete();
      };

      reader.onerror = () => {
        observer.error(reader.error);
      };

      reader.readAsArrayBuffer(file);
    });
  }
}
