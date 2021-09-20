import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Consts } from '../consts';
import { PersonnelInfo } from '../core/models/personnelInfo';
import { GroupInfo } from '../core/models/groupInfo';
import { UnitInfo } from '../core/models/unitInfo';
import { RoleInfo } from '../core/models/roleInfo';
import { StatusesInfo } from '../core/models/statusesInfo';
import { SubmitStatus } from '../core/models/submitStatus';
import { CallPriorityResult } from '../core/models/callPriorityResult';
import { DepartmentResult } from '../core/models/departmentResult';
import { CoreDataResult } from '../core/models/coreDataResult';
import { UtilsProvider } from './utils';
import { SettingsProvider } from './settings';
import { SecurityProvider } from './security';
import { DepartmentRightsResult } from '../core/models/departmentRightsResult';
import { LocalDbProvider } from './localDb';

@Injectable({
  providedIn: 'root'
})
export class DataProvider {
  private db;
  private syncing: boolean;

  private personnel: PersonnelInfo[];
  private groups: GroupInfo[];
  private units: UnitInfo[];
  private roles: RoleInfo[];
  private statuses: StatusesInfo[];
  private priorities: CallPriorityResult[];
  private departments: DepartmentResult[];

  constructor(public http: HttpClient,
    private consts: Consts,
    private utils: UtilsProvider,
    private securityProvider: SecurityProvider,
    private settingsProvider: SettingsProvider,
    private localDbProvider: LocalDbProvider) {
    this.syncing = false;
    this.personnel = new Array<PersonnelInfo>();
    this.groups = new Array<GroupInfo>();
    this.units = new Array<UnitInfo>();
    this.roles = new Array<RoleInfo>();
    this.statuses = new Array<StatusesInfo>();
    this.priorities = new Array<CallPriorityResult>();
    this.departments = new Array<DepartmentResult>();
  }

  public init(): Promise<any> {
    return this.localDbProvider.init();
  }

  private forceSync() {
    this.sync(true, null, null);
  }

  public prime(): Promise<any> {
    return this.localDbProvider.setLocalData();
  }

  public sync(forceSync: boolean, serviceLastChange?: string, lastSync?: string): Promise<boolean> {
    return this.localDbProvider.sync(forceSync, serviceLastChange, lastSync);
  }

  public isCurrentlySyncing() {
    // return this.syncing;
    return this.localDbProvider.isCurrentlySyncing();
  }

  public setLocalData(): Promise<boolean> {
    return this.localDbProvider.setLocalData();
  }

  public getAllPersonnel(): Promise<PersonnelInfo[]> {
    return this.localDbProvider.getAllPersonnel();
  }

  public getAllGroups(): Promise<GroupInfo[]> {
    return this.localDbProvider.getAllGroups();
  }

  public getAllStationGroups(): Promise<GroupInfo[]> {
    return this.localDbProvider.getAllStationGroups();
  }

  public getAllUnits(): Promise<UnitInfo[]> {
    return this.localDbProvider.getAllUnits();
  }

  public getAllRoles(): Promise<RoleInfo[]> {
    return this.localDbProvider.getAllRoles();
  }

  public getAllStatuses(): Promise<StatusesInfo[]> {
    return this.localDbProvider.getAllStatuses();
  }

  public getAllPriorites(): Promise<CallPriorityResult[]> {
    return this.localDbProvider.getAllPriorites();
  }

  public getActivePriorites(): Promise<CallPriorityResult[]> {
    return this.localDbProvider.getActivePriorites();
  }

  public getAllDepartments(): Promise<DepartmentResult[]> {
    return this.localDbProvider.getAllDepartments();
  }

  public getPerson(userId: string): PersonnelInfo {
    return this.localDbProvider.getPerson(userId);
  }

  public getUnit(unitId: number): UnitInfo {
    return this.localDbProvider.getUnit(unitId);


  }

  public getGroup(groupId: number): GroupInfo {
    return this.localDbProvider.getGroup(groupId);
  }

  public getPersonnelForGroup(groupId: number): PersonnelInfo[] {
    return this.localDbProvider.getPersonnelForGroup(groupId);
  }

  public getRole(roleId: number): RoleInfo {
    return this.localDbProvider.getRole(roleId);
  }

  public addStatusQueue(status: SubmitStatus) {
    this.localDbProvider.addStatusQueue(status);
  }
}
