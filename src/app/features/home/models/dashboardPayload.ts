import { UnitStatusResult } from 'src/app/core/models/unitStatusResult';
import { CallResult } from 'src/app/core/models/callResult';
import { UnitInfo } from 'src/app/core/models/unitInfo';
import { UnitStatusFullResult } from 'src/app/core/models/unitStatusFullResult';
import { CallPriorityResult } from 'src/app/core/models/callPriorityResult';
import { CallTypeResult } from 'src/app/core/models/callTypeResult';
import { PersonnelForCallResult } from 'src/app/core/models/personnelForCallResult';
import { GroupsForCallResult } from 'src/app/core/models/groupsForCallResult';
import { RolesForCallResult } from 'src/app/core/models/rolesForCallResult';
import { FormDataResult } from 'src/app/core/models/formDataResult';

export class DashboardPayload {
    public UnitStatuses: UnitStatusFullResult[];
    public Calls: CallResult[];
    public CallPriorties: CallPriorityResult[];
    public CallTypes: CallTypeResult[];
    public PersonnelForGrid: PersonnelForCallResult[];
    public GroupsForGrid: GroupsForCallResult[];
    public RolesForGrid: RolesForCallResult[];
    public NewCallForm: FormDataResult;
}
