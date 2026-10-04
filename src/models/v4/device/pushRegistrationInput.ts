/** Registers this device's push token on the signed-in dispatcher's user subscriber (Core v4 Devices/RegisterDevice). */
export class PushRegistrationInput {
  public UserId: string = '';
  public Token: string = '';
  public Platform: number = 0;
  public DeviceUuid: string = '';
  public Prefix: string = '';
}
