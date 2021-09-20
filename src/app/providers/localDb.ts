import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
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

@Injectable({
  providedIn: 'root'
})
export class LocalDbProvider {
  private storage: any;
  private data: CoreDataResult;
  private pendingStatuses: SubmitStatus[];
  private syncing: boolean;

  constructor(public http: HttpClient,
    private consts: Consts,
    private utils: UtilsProvider,
    private securityProvider: SecurityProvider,
    private settingsProvider: SettingsProvider) {

    this.gapStorage();

    this.syncing = false;
  }


  private gapStorage() {
    // Ok, NativeStorage should support local storage fallback, but it doesn't presist, so have this fake for web fallback.
    if (window['cordova']) {
      //this.storage = this.nativeStorage;
    } else {
      this.storage = {
        setItem: (key, value) => {
          return new Promise((resolve, reject) => {
            try {
              window.localStorage.setItem(key, JSON.stringify(value));
              resolve(true);
            } catch (error) {
              reject(error);
            }
          });
        },
        getItem: (key) => {
          return new Promise((resolve, reject) => {
            try {
              const result = window.localStorage.getItem(key);
              resolve(JSON.parse(result));
            } catch (error) {
              reject(error);
            }
          });
        },
        remove: (key) => {
          return new Promise((resolve, reject) => {
            try {
              window.localStorage.removeItem(key);
              resolve(true);
            } catch (error) {
              reject(error);
            }
          });
        },
        clear: () => {
          return new Promise((resolve, reject) => {
            try {
              window.localStorage.clear();
              resolve(true);
            } catch (error) {
              reject(error);
            }
          });
        },
      }
    }
  }

  public init(): Promise<boolean> {
    let that: any = this;

    return new Promise((resolve, reject) => {
      resolve(true);
    });

  }

  public sync(forceSync: boolean, serviceLastChange?: string, lastSync?: string): Promise<boolean> {
    const that = this;

    return new Promise((resolve, reject) => {
      // If the server has had updates more recently then our last sync
      let serverHasBeenUpdated: boolean;
      if (serviceLastChange && lastSync) {
        if (new Date(serviceLastChange) > new Date(lastSync)) {
          serverHasBeenUpdated = true;
        }
      } else {
        serverHasBeenUpdated = false;
      }

      // Force a sync every 30 days
      var localDataIsStale: boolean;
      if (lastSync) {
        let currentDate = new Date();
        currentDate.setMonth(currentDate.getMonth() - 1);
        if (new Date(currentDate) > new Date(lastSync)) {
          localDataIsStale = true;
        }
      } else {
        localDataIsStale = true;
      }

      // Hack to try and force re-syncing with the move to sqlite
      if (!this.data || !this.data.Personnel || this.data.Personnel.length <= 0) {
        forceSync = true;
      }

      if (forceSync || serverHasBeenUpdated || localDataIsStale) {
        this.http.get<CoreDataResult>(environment.baseApiUrl + environment.resgridApiUrl + '/CoreData/GetCoreData').subscribe(
          data => {
            that.syncing = true;
            that.data = data;
            that.save();

            that.syncing = false;
            //that.pubsub.$pub(that.consts.EVENTS.LOCAL_DATA_SET, '');
            //that.pubsub.$pub(that.consts.EVENTS.COREDATASYNCED, '');
            resolve(true);
          },
          error => {
            that.syncing = false;
            //that.pubsub.$pub(this.consts.EVENTS.LOCAL_DATA_SET, '');
            resolve(false);
          });
      } else {

        this.setLocalData()
          .then(() => {
            that.syncing = false;
            resolve(true);
          })
          .catch(e => {
            that.syncing = false;
            resolve(false);
          });
      }

      this.securityProvider.applySecurityRights();
    });
  }

  public isCurrentlySyncing() {
    return this.syncing;
  }

  public setLocalData(): Promise<boolean> {
    const that = this;
    return new Promise((resolve, reject) => {
      if (this.storage) {

        that.storage.getItem('RGResponderData').then(function result(data: CoreDataResult) {
          if (data) {
            that.data = data;
          } else {
            that.data = new CoreDataResult();
          }
          resolve(true);
        }).catch(function (err) {
          that.data = new CoreDataResult();

          resolve(true);
        });

      } else {
        //this.pubsub.$pub(this.consts.EVENTS.LOCAL_DATA_SET, '');
        return resolve(false);
      }
    });
  }

  private save() {
    return this.storage.setItem('RGResponderData', this.data);
  }

  public getAllPersonnel(): Promise<PersonnelInfo[]> {
    return new Promise((resolve, reject) => {
      if (this.data && this.data.Personnel) {
        resolve(this.data.Personnel);
      } else {
        resolve(new Array());
      }
    });
  }

  public getAllGroups(): Promise<GroupInfo[]> {
    return new Promise((resolve, reject) => {
      if (this.data && this.data.Groups) {
        resolve(this.data.Groups);
      } else {
        resolve(new Array());
      }
    });
  }

  public getAllStationGroups(): Promise<GroupInfo[]> {
    return new Promise((resolve, reject) => {
      if (this.data && this.data.Groups) {
        let stationGroups = this.data.Groups.filter(group => group.GroupType === 'Station');
      return resolve(stationGroups);
      } else {
        resolve(new Array());
      }
    });
  }

  public getAllUnits(): Promise<UnitInfo[]> {
    return new Promise((resolve, reject) => {
      if (this.data && this.data.Units) {
        return resolve(this.data.Units);
      } else {
        resolve(new Array());
      }
    });
  }

  public getAllRoles(): Promise<RoleInfo[]> {
    return new Promise((resolve, reject) => {
      if (this.data && this.data.Roles) {
        return resolve(this.data.Roles);
      } else {
        resolve(new Array());
      }
    });
  }

  public getAllStatuses(): Promise<StatusesInfo[]> {
    return new Promise((resolve, reject) => {
      if (this.data && this.data.Statuses) {
        return resolve(this.data.Statuses);
      } else {
        resolve(new Array());
      }
    });
  }

  public getAllPriorites(): Promise<CallPriorityResult[]> {
    return new Promise((resolve, reject) => {
      if (this.data && this.data.Priorities) {
        return resolve(this.data.Priorities);
      } else {
        resolve(new Array());
      }
    });
  }

  public getActivePriorites(): Promise<CallPriorityResult[]> {
    return new Promise((resolve, reject) => {
      if (this.data && this.data.Priorities) {
        let activePriorities = this.data.Priorities.filter(priority => priority.IsDeleted === false);
      resolve(activePriorities);
      } else {
        resolve(new Array());
      }
    });
  }

  public getAllDepartments(): Promise<DepartmentResult[]> {
    return new Promise((resolve, reject) => {
      if (this.data && this.data.Departments) {
        return resolve(this.data.Departments);
      } else {
        resolve(new Array());
      }
    });
  }

  public getPerson(userId: string): PersonnelInfo {
    if (this.data && this.data.Personnel) {
      let person = this.data.Personnel.find(person => person.Uid == userId);

      if (person)
        return person;
    }

    return null;
  }

  public getUnit(unitId: number): UnitInfo {
    if (this.data && this.data.Units) {
      let unit = this.data.Units.find(unit => unit.Uid == unitId);

      if (unit)
        return unit;
    }

    return null;
  }

  public getGroup(groupId: number): GroupInfo {
    if (this.data && this.data.Groups) {
      let group = this.data.Groups.find(group => group.Gid == groupId);

      if (group)
        return group;
    }

    return null;
  }

  public getPersonnelForGroup(groupId: number): PersonnelInfo[] {
    let personnel: PersonnelInfo[] = new Array<PersonnelInfo>();
    if (this.data && this.data.Personnel) {
      this.data.Personnel.forEach(person => {
        if (person.Gid == groupId) {
          personnel.push(person);
        }
      });
    }

    return personnel;
  }

  public getRole(roleId: number): RoleInfo {
    if (this.data && this.data.Roles) {
      let role = this.data.Roles.find(role => role.Rid == roleId);

      if (role)
        return role;
    }

    return null;
  }

  private loadPendingStatuses() {
    this.storage.getItem('RGResponderPenStat').then(function result(statuses: SubmitStatus[]) {
      if (statuses && statuses.length > 0) {
        this.pendingStatuses = statuses;
      } else {
        this.pendingStatuses = new Array<SubmitStatus>();
      }
    }).catch(function (err) {
      this.pendingStatuses = new Array<SubmitStatus>();

    });
  }

  public addStatusQueue(status: SubmitStatus) {
    if (!this.pendingStatuses)
      this.pendingStatuses = new Array<SubmitStatus>();

    this.pendingStatuses.push(status);
    this.storage.setItem('RGResponderPenStat', this.pendingStatuses);
  }
}
