import { InjectionToken } from '@angular/core';

//https://gist.github.com/rossholdway/16724496806b66a162ee6cbf8bfc5def

/**
 * Use an Angular2 InjectionToken to avoid conflicts in case you import modules that define a token with the same name ('app.config')
 * @type {InjectionToken}
 */
export let APP_CONFIG_TOKEN = new InjectionToken('app.config');

export interface AppConfig {
  BaseApiUrl:         string;
  ResgridApiUrl:      string;
  ChannelUrl:         string;
  ChannelHubName:     string;
  What3WordsKey:      string;
  IsDemo:             boolean;
  DemoToken:          string;
  Version:            string;
  ReleaseDate:        string;
  MapApiKey:          string;
  FirebaseApiKey:     string;
  FirebaseAuthDomain: string;
  FirebaseDbUrl:      string;
  FirebaseProjId:     string;
  FirebaseStorage:    string;
  FirebaseSenderId:   string;
}