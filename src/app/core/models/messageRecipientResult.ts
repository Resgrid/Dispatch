export class MessageRecipientResult  {
    public Mid: number = 0;    // Message Id
    public Uid: string = "";   // UserId of the Rexipient
    public Ron: string = "";   // User Responded\Read On
    public Rty: string = "";   // User Response type to the message
    public Not: string = "";   // User Note for the response

    // Local Data
    public ReceivingUser: string = ""; 
}