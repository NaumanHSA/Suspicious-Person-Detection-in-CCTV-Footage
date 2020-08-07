import { Component, OnInit, Inject, ViewChild, ElementRef } from '@angular/core';
import { SidenavService } from 'src/app/Services/side-nav.service';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { LocalStorageService, DetectionConfiguration } from 'src/app/Services/local-storage.service';
import { WebsocketService } from 'src/app/Services/websocket.service';
import { async } from '@angular/core/testing';

export interface DialogData {
  title: string,
  error: string
}

@Component({
  selector: 'snack-bar-component',
  templateUrl: '../shared/dialog-component.html'
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
  selector: 'app-right-side-nav',
  templateUrl: './right-side-nav.component.html',
  styleUrls: ['./right-side-nav.component.css']
})
export class RightSideNavComponent implements OnInit {

  @ViewChild('btnGeneral') public generalBtn: ElementRef;

  filePath: string;
  confidence: number = 0.3;
  NMS: number = 0.3;
  IoW: number = 0.3;
  res: number = 416;
  weights: string;
  cfg: string;
  classes: string;
  batch_size: number = 1;
  isSavedSuccess: boolean = false;
  isSavedDanger: boolean = false;
  directoryExist: boolean = false;
  page_general: boolean = true;
  page_config: boolean = false;
  page_noti: boolean = false;
  isError = {
    output: false,
    weights: false,
    cfg: false,
    classes: false
  };
  error = {
    output: '',
    weights: '',
    cfg: '',
    classes: ''
  };

  constructor(public sidenav: SidenavService, private dialog: MatDialog, public websockets: WebsocketService,
    public localStorage: LocalStorageService) { }

  ngOnInit(): void {
    let data = this.localStorage.getData('paths');

    if (data != null) {
      this.filePath = data.output_path;
      this.confidence = Number(data.confidence);
      this.NMS = Number(data.NMS);
      this.res = Number(data.res);
      this.weights = data.weights;
      this.cfg = data.cfg;
      this.batch_size = data.batch_size,
        this.IoW = data.IoW,
        this.classes = data.classes
    }
    else {
      this.openDialog('Alert', 'Please set detection configuration from settings');
    }

  }

  ngAfterViewInit(): void {
    // this.generalBtn.nativeElement.focus();
  }

  toggleSideNav() {
    this.sidenav.toggle();
    this.isSavedSuccess = false;
    this.isSavedDanger = false;
  }

  handleOutputEvent(event: any, flag: Number) {
    try {
      if (flag == 1) {
        this.weights = event.target.files[0].path
      }
      else if (flag == 2) {
        this.cfg = event.target.files[0].path
      }
      else {
        this.classes = event.target.files[0].path
      }
      return;
    }
    catch{ }
  }

  onSaveButton() {
    this.validation().then(res => {
      if (!res) {
        this.isSavedSuccess = false;
        this.isSavedDanger = true;
      }
      else {
        let configurations: DetectionConfiguration = {
          output_path: this.filePath,
          NMS: this.NMS,
          confidence: this.confidence,
          weights: this.weights,
          cfg: this.cfg,
          res: this.res,
          batch_size: this.batch_size,
          IoW: this.IoW,
          classes: this.classes
        }
        this.localStorage.storeData('paths', configurations);
        this.isSavedSuccess = true;
        this.isSavedDanger = false;
      }
    });
  }

  async validation(): Promise<boolean> {

    if (this.filePath == undefined || this.filePath == '') {
      this.isError.output = true;
      this.error.output = 'Specify output directory path';
      return new Promise<boolean>(resolve => {
        resolve(false);
      });
    } else {
      await this.isDirectoryExist();
      if (!this.directoryExist) {
        this.isError.output = true;
        this.error.output = 'Selected folder does not exists';
        return new Promise<boolean>(resolve => {
          resolve(false);
        });
      } else {
        this.isError.output = false;
        this.error.output = '';
      }
    }

    if (this.weights != undefined) {
      if (this.weights.split('.').pop() != 'weights') {
        this.isError.weights = true;
        this.error.weights = 'Selected weight file is not valid';
        return new Promise<boolean>(resolve => {
          resolve(false);
        });
      } else {
        this.isError.weights = false;
        this.error.weights = '';
      }
    } else {
      this.isError.weights = true;
      this.error.weights = 'Please select a weight file first';
      return new Promise<boolean>(resolve => {
        resolve(false);
      });
    }

    if (this.cfg != undefined) {
      if (this.cfg.split('.').pop() != 'cfg') {
        this.isError.cfg = true;
        this.error.cfg = 'Selected cfg file is not valid';
        return new Promise<boolean>(resolve => {
          resolve(false);
        });
      } else {
        this.isError.cfg = false;
        this.error.cfg = '';
      }
    } else {
      this.isError.cfg = true;
      this.error.cfg = 'Select a cfg file first';
      return new Promise<boolean>(resolve => {
        resolve(false);
      });
    }

    if (this.classes != undefined) {
      if (this.classes.split('.').pop() != 'names') {
        this.isError.classes = true;
        this.error.classes = 'Selected file is not valid';
        return new Promise<boolean>(resolve => {
          resolve(false);
        });
      } else {
        this.isError.classes = false;
        this.error.classes = '';
      }
    } else {
      this.isError.classes = true;
      this.error.classes = 'Select a classes file';
      return new Promise<boolean>(resolve => {
        resolve(false);
      });
    }

    return new Promise<boolean>(resolve => {
      resolve(true);
    });
  }

  isDirectoryExist(): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.websockets.emit('validate-config', this.filePath);
      this.websockets.listen('validate-config').subscribe(res => {
        if (!res) this.directoryExist = false;
        else this.directoryExist = true;
        resolve();
      });
    })
  }

  navigate(flag) {
    if (flag == 0) {
      this.page_general = true;
      this.page_config = this.page_noti = false;
      this.isSavedDanger = this.isSavedSuccess = false;
    }
    else if (flag == 1) {
      this.page_config = true;
      this.page_general = this.page_noti = false;
      this.isSavedDanger = this.isSavedSuccess = false;
    }
    else {
      this.page_noti = true;
      this.page_config = this.page_general = false;
      this.isSavedDanger = this.isSavedSuccess = false;
    }
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
