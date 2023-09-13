import { Component, OnInit, Input } from "@angular/core";
import { HomeState } from "../../store/home.store";

@Component({
  selector: "app-calls-list",
  templateUrl: "./calls-list.html",
  styleUrls: ["./calls-list.scss"],
})
export class CallsListComponent implements OnInit {
  @Input() state: HomeState;

  constructor() {}

  ngOnInit() {}
}
