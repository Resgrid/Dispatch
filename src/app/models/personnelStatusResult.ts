export class PersonnelStatusResult  {
    public Uid: string = "";    // UserId of the user
    public Atp: number = 0;   // Action Type
    public Atm: string = "";   // Action Timestamp
    public Did: number = 0;    // Destionation Id
    public Ste: number = 0;    // State of the User
    public Stm: string = "";   // State Timestamp

    // Local Data
    public Roles: string = "";
    public Name: string = "";
    public ActionText: string = "";
    public ActionColor: string = "";
    public StateText: string = "";
    public StateColor: string = "";
}