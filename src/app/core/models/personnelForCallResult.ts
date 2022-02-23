import { GetPersonnelForCallGridResultData } from '@resgrid/ngx-resgridlib';

export class PersonnelForCallResult extends GetPersonnelForCallGridResultData {
    public Selected: boolean = false;
    public Distance: number = 0;
}
