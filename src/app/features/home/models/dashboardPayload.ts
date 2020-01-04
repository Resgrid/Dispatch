import { UnitStatusResult } from 'src/app/models/unitStatusResult';
import { CallResult } from 'src/app/models/callResult';
import { UnitInfo } from 'src/app/models/unitInfo';
import { UnitStatusFullResult } from 'src/app/models/unitStatusFullResult';

export class DashboardPayload {
    public UnitStatuses: UnitStatusFullResult[];
    public Calls: CallResult[];
}
