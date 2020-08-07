import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SharedDataService {

  notifications = [];
  notification_subject = new Subject<any>();
  clearNotifications_subject = new Subject<any>();
  isNotification_subject = new Subject<boolean>();

  constructor() {}

  addNotification(notification: any){
    this.notification_subject.next(notification);
  }
  changeNotification(value: boolean){
    this.isNotification_subject.next(value);
  }
  clearNotifications(){
    this.clearNotifications_subject.next();
  }
  getNotifications(): Observable<any>{
    return this.notification_subject.asObservable();
  }
  getNotificationChange(): Observable<boolean>{
    return this.isNotification_subject.asObservable();
  }
  getClearNotifications(): Observable<any>{
    return this.clearNotifications_subject.asObservable();
  }
}
