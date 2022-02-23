import { CallPriorityResultData, CallResultData, CallTypeResultData, FormResultData, GetPersonnelForCallGridResultData, GetRolesForCallGridResultData, UnitStatusResultData, GroupsForCallGridData } from "@resgrid/ngx-resgridlib";

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
