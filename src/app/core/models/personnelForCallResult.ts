import { GetPersonnelForCallGridResultData } from "@resgrid-shared/ngx-resgridlib";

export class PersonnelForCallResult extends GetPersonnelForCallGridResultData {
    public Selected: boolean = false;
    public Distance: number = 0;
}
