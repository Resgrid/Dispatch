import { MessageRecipientResult } from "./messageRecipientResult";

export class MessageResult  {
    public Mid: number = 0;    // Message Id
    public Typ: number = 0;    // Group Type
    public Sub: string = "";   // Subect
    public Uid: string = "";   // UserId
    public Bdy: string = "";   // Body
    public Son: string = "";   // Sent On
    public SUtc: string = "";   // Sent On (UTC)
    public Exp: string = "";   // Expired On
    public Rsp: Boolean = false;   // Responded To
    public Not: string = "";   // User Supplied Note
    public Ron: string = "";   // User Responded On
    public Rty: string = "";   // User Response Type
    public Sys: Boolean = false;   // Whats the message system generated

    public Rcpts: MessageRecipientResult[];

    // Local Data
    public SendingUser: string = ""; 
}