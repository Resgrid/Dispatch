import { CallResultData, CustomStatusResultData, GroupResultData } from "@resgrid-shared/ngx-resgridlib";

export class SetUnitStateModalData {
    public UnitId: string;
    public UnitName: string;
    public Stations: GroupResultData[];
    public Calls: CallResultData[];
    public Statuses: CustomStatusResultData[];
}
