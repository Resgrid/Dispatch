/** Takes a browser or desktop push token off the web push channel it was registered on (Core v4 Devices/UnRegisterWebPush). */
export class WebPushUnRegistrationInput {
  public Token: string = '';
  public Prefix: string = '';
}
