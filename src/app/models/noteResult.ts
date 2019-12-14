export class NoteResult  {
    public Nid: number = 0;    // Note Id
    public Uid: string = "";   // UserId
    public Ttl: string = "";   // Title of the Note
    public Bdy: string = "";   // Body
    public Cat: string = "";   // Note Category
    public Clr: string = "";   // Note Category Color
    public Exp: string = "";   // Note Expires On (nullable)
    public Adn: string = "";   // Note Added On

    public AddedBy: string = "";
}