import { AfterViewInit, Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { IDevice } from "src/app/core/models/deviceType";
import { OpenViduDevicesService } from "src/app/providers/openviduDevices";

@Component({
  selector: "app-profile-edit-profile",
  templateUrl: "./edit-profile.page.html",
  styleUrls: ["./edit-profile.page.scss"],
})
export class EditProfilePage implements OnInit, AfterViewInit {
  public breadCrumbItems: Array<{}>;
  public microphones: IDevice[] = [];
  public selectedMicrophone: IDevice;

  constructor(private deviceService: OpenViduDevicesService, private router: Router) {

  }

  ngOnInit(): void {
    this.breadCrumbItems = [
        { label: "Resgrid Dispatch" },
        { label: "Edit Profile", active: true },
      ];
  }

  ngAfterViewInit(): void {
    this.deviceService.initDevices().then(() => {
      this.microphones = this.deviceService.getMicrophones();
      this.selectedMicrophone = this.deviceService.getMicSelected();
    });
  }

  public save() {
    this.deviceService.setMicSelected(this.selectedMicrophone?.device);
    this.router.navigate(['/home']);
  }
}
