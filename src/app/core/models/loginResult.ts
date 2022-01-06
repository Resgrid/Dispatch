import { DepartmentRightsResultData, ProfileModel } from "@resgrid-shared/ngx-resgridlib";

export class LoginResult implements ProfileModel {
    public sub: string = '';
    public jti: string = '';
    public useage: string = '';
    public at_hash: string = '';
    public nbf: number = 0;
    public exp: number = 0;
    public iat: number = 0;
    public iss: string = '';
    public name: string = '';
    public oi_au_id: string = '';
    public oi_tkn_id: string = '';
    public Rights: DepartmentRightsResultData = new DepartmentRightsResultData();
}