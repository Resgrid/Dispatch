import { CallPriorityResultData, CallResultData, CallTypeResultData, FormResultData, GetPersonnelForCallGridResultData, GetRolesForCallGridResultData, UnitStatusResultData } from "@resgrid-shared/ngx-resgridlib";
import { GroupsForCallGridData } from "@resgrid-shared/ngx-resgridlib/lib/models/v4/dispatch/getGroupsForCallGridResultData";


export class DashboardPayload {
    public UnitStatuses: UnitStatusResultData[];
    public Calls: CallResultData[];
    public CallPriorties: CallPriorityResultData[];
    public CallTypes: CallTypeResultData[];
    public PersonnelForGrid: GetPersonnelForCallGridResultData[];
    public GroupsForGrid: GroupsForCallGridData[];
    public RolesForGrid: GetRolesForCallGridResultData[];
    public NewCallForm: FormResultData;
}
