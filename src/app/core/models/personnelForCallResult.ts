export class PersonnelForCallResult  {
    public UserId: string = "";
    public Name: string = "";
    public FirstName: string = "";
    public LastName: string = "";
    public Group: string = "";
    public GroupId: number = 0;
    public Status: string = "";
    public StatusColor: string = "";
    public Staffing: string = "";
    public StaffingColor: string = "";
    public Eta: string = "";
    public Weight: number = 0;
    public Roles: Array<string>;
    public Location: string = "";

    // Local data
    public Selected: boolean = false;
    public Distance: number = 0;
}
