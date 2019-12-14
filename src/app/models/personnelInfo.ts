export class PersonnelInfo  {
    public Uid: string = "";    // UserId
    public Did: string = "";    // DepartmentId
    public Id: string = "";     // Custom Id
    public Fnm: string = "";    // First Name
    public Lnm: string = "";    // Last Name
    public Eml: string = "";    // Email Address
    public Mnu: string = "";    // Mobile Phone Number
    public Gid: number = 0;     // Group Id
    public Gnm: string = "";    // Group Name
    public Roles: string[];     // Roles
    public Ats: number = 0;     // Current Action
    public Atm: string = "";    // Current Action Timestamp in UTC
    public Dsi: string = "";    // Destoniation Id
    public Dsn: string = "";    // Destoniation Name
    public Stf: number = 0;     // Current Staffing
    public Stm: string = "";    // Current Staffing Timestamp in UTC
}