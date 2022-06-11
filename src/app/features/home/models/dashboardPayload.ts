import { CallPriorityResultData, CallResultData, CallTypeResultData, FormResultData, GetPersonnelForCallGridResultData, GetRolesForCallGridResultData, UnitStatusResultData, GroupsForCallGridData, CustomStatusResultData, NoteResultData, CallNoteTemplateResultData } from "@resgrid/ngx-resgridlib";

export class DashboardPayload {
    public UnitStatuses: UnitStatusResultData[];
    public Calls: CallResultData[];
    public CallPriorties: CallPriorityResultData[];
    public CallTypes: CallTypeResultData[];
    public PersonnelForGrid: GetPersonnelForCallGridResultData[];
    public GroupsForGrid: GroupsForCallGridData[];
    public RolesForGrid: GetRolesForCallGridResultData[];
    public NewCallForm: FormResultData;
    public PersonnelStatuses: CustomStatusResultData[];
    public PersonnelStaffingLevels: CustomStatusResultData[];
    public DispatchNote: NoteResultData
    public CallNotes: CallNoteTemplateResultData[];
}
