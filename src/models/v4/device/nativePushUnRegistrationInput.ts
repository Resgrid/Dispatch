/** Takes a native (iOS or Android) push token off the channels it was registered on (Core v4 Devices/UnRegisterNativePush). */
export class NativePushUnRegistrationInput {
  public Token: string = '';
  public Prefix: string = '';
}
