import { UnitStatusResult } from 'src/app/models/unitStatusResult';
import { CallResult } from 'src/app/models/callResult';

export class DashboardPayload {
    public Units: UnitStatusResult[];
    public Calls: CallResult[];
}
