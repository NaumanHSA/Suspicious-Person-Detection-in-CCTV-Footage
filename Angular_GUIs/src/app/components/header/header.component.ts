import { Component, OnInit, Inject } from '@angular/core';
import { WebsocketService } from 'src/app/Services/websocket.service';
import { SidenavService } from 'src/app/Services/side-nav.service';
import { SharedDataService } from 'src/app/Services/shared-data.service';
import { Subscription } from 'rxjs';
import { LocalStorageService } from 'src/app/Services/local-storage.service';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface DialogData {
  title: string,
  error: string
}

@Component({
  selector: 'snack-bar-component',
  templateUrl: './dialog-component.html'
})
export class DialogOverview {

  constructor(
    public dialogRef: MatDialogRef<DialogOverview>, public websocket: WebsocketService,
    @Inject(MAT_DIALOG_DATA) public data: DialogData) { }

  onNoClick(): void {
    this.dialogRef.close();
  }
  onYesClick(): void{
    this.websocket.emit('close-app', 'close');
  }
}

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {

  notifications = [];
  isNotification: boolean = false;
  newNoti: number = 0;
  subscription: Subscription;

  constructor(public websocket: WebsocketService, private sidenav: SidenavService, private dialog: MatDialog, 
    public sharedDataService: SharedDataService, public localStorageService: LocalStorageService) {

    this.subscription = sharedDataService.getNotifications().subscribe(notifictaion => {
      this.notifications.push(notifictaion);
    });
    this.subscription = sharedDataService.getNotificationChange().subscribe(value => {
      if(!value){
        this.newNoti = 0;
      }
      this.isNotification = value;
      this.newNoti++;
    });
    this.subscription = sharedDataService.getClearNotifications().subscribe(() => {
      this.notifications = [];
    });
  }

  ngOnInit(): void {
  }

  onHeaderButton(command) {
    if(command == 'close'){
      this.openDialog('Alert', 'Are you sure to close the application?')
    }
    else{
      this.websocket.emit('close-app', command);
    }
  }
  toggleSidenav() {
    this.sidenav.toggle();
  }
  onNotificationButton(){
    this.sharedDataService.changeNotification(false);
  }
  onClearNotifications(){
    this.sharedDataService.clearNotifications();
  }
  onExplorerButton(command){
    this.websocket.emit('file-explorer', {command: command, path: this.localStorageService.getData('paths').output_path})
  }

  openDialog(title, error): void {
    const dialogRef = this.dialog.open(DialogOverview, {
      width: '500px',
      data: {
        title: title,
        error: error
      }
    });
  }
}
