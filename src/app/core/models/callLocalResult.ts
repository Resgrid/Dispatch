import { CallResultData } from "@resgrid/ngx-resgridlib";

export class CallLocalResult extends CallResultData {
  public PriorityColor: string = "";
  public PriorityText: string = "";
  public Selected: boolean = false;
}
