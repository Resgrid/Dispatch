import { UnitStatusResultData } from "@resgrid-shared/ngx-resgridlib";

export class UnitStatusResult extends UnitStatusResultData {
    public Selected: boolean = false;
    public SelectedForDispatch: boolean = false;
    public Distance: number = 0;
}
