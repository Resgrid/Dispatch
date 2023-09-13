import { Component, OnInit, Input } from "@angular/core";
import { HomeState } from "../../store/home.store";

@Component({
  selector: "app-units-list",
  templateUrl: "./units-list.html",
  styleUrls: ["./units-list.scss"],
})
export class UnitListComponent implements OnInit {
  @Input() state: HomeState;
  data: any;

  constructor() {}

  ngOnInit() {}
}
