import { UnitStatusResultData } from '@resgrid/ngx-resgridlib';

export class UnitStatusResult extends UnitStatusResultData {
    public Selected: boolean = false;
    public SelectedForDispatch: boolean = false;
    public Distance: number = 0;
}
