import { Component, OnInit, ViewChild, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { WebsocketService } from './Services/websocket.service';
import { SidenavService } from './Services/side-nav.service';
import { MatSidenav } from '@angular/material/sidenav';

export interface DialogData {
  title: string,
  error: string
}

@Component({
  selector: 'snack-bar-component',
  templateUrl: './components/shared/dialog-component.html'
})
export class DialogOverview {

  constructor(
    public dialogRef: MatDialogRef<DialogOverview>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData) { }

  onNoClick(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {

  constructor(public websocket: WebsocketService, private sidenavService: SidenavService, private dialog: MatDialog) { }

  @ViewChild('sidenav') public sidenav: MatSidenav;

  ngAfterViewInit(): void {
    this.sidenavService.setSidenav(this.sidenav);
    this.websocket.emit('python_client', true);
    this.websocket.listen('python_client').subscribe( res => {
      if (!res) {
        this.openDialog('Alert', 'No response from backend python script. You will not be able to start detection Run python scripts first to establish connection');
      }    
      this.websocket.removeListner('python_client');
    });
  }

  ngOnInit(): void {
    this.websocket.emit('user-connected', 'angular');
  }

  openDialog(title, error): void {
    const dialogRef = this.dialog.open(DialogOverview, {
      width: '500px',
      data: {
        title: title,
        error: error
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      // console.log('The dialog was closed');
    });
  }
}
