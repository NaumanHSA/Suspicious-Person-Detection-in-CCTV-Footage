import { Component, OnInit, ViewEncapsulation, Inject } from '@angular/core';
import { WebsocketService } from 'src/app/Services/websocket.service';
import * as CanvasJS from 'canvasjs/canvasjs.min';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { LocalStorageService } from 'src/app/Services/local-storage.service';
import { SharedDataService } from 'src/app/Services/shared-data.service';

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
  selector: 'app-live-cam',
  templateUrl: './live-cam.component.html',
  styleUrls: ['./live-cam.component.css']
})

export class LiveCamComponent implements OnInit {

  isLocalDisabled = false;
  isRemoteDisabled = false;
  buttonTitle = 'Start Detection';
  isDetection: boolean = false;
  inputText = '';
  videoURL = '';
  videoPath = '';
  buttonStyle_1 = 'button btn btn-success';
  buttonStyle_2 = 'button btn btn-success';
  showRecord: boolean = false;
  isLoading: boolean = false;
  isFullScreen: boolean = false;
  confidence_weapon: number = 0;
  confidence_person: number = 0;
  confidence_suspicious: number = 0;

  datapoints_progress = [];
  datapoints_location = [];
  progressChart: any;
  locationChart: any;
  frame_number: number = 0;
  frame_width: number = 0;
  frame_height: number = 0;
  counter = 0;
  tots = 0;
  fps = 0;
  stripLines = [];
  port_selected: string;
  ports = [0, 1, 2, 3];
  cnt: number = 0;

  alarm = new Audio();

  constructor(public websocket: WebsocketService, private sharedDataService: SharedDataService,
    private dialog: MatDialog, public localStorage: LocalStorageService) { }

  ngOnInit(): void {
    this.alarm.src = "./assets/audio/alarm.mp3";
    this.alarm.load();
  }

  onLocalDetectionButton() {

    this.websocket.emit('python_client', true);
    this.websocket.listen('python_client').subscribe(res => {
      if (!res) {
        this.openDialog('Error', 'There was no response from backend python script. Python client is not connected. Run python scripts first to establish connection');
      }
      else if (this.port_selected == undefined) {
        this.openDialog('Error', 'Please Select port number !!!');
      }
      else if (!this.localStorageCheck()) {
        this.openDialog('Error', 'Please set configurations from settings');
      }
      else { this.startDetection(this.port_selected, 'webcame-local') }
      this.websocket.removeListner('python_client');
    });
  }

  onRemoteDetectionButton() {

    let regex: RegExp = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
    this.websocket.emit('python_client', true);
    this.websocket.listen('python_client').subscribe(res => {
      if (!res) {
        this.openDialog('Error', 'There was no response from backend python script. Python client is not connected. Run python scripts first to establish connection');
      }
      else if (this.inputText == '') {
        this.openDialog('Error', 'Please Enter Streaming URL');
      }
      else if (!regex.test(this.inputText)) {
        this.openDialog('Error', 'Please Enter a valid streaming URL');
      }
      else if (!this.localStorageCheck()) {
        this.openDialog('Error', 'Please set configurations from settings');
      }
      else {
        this.startDetection(this.inputText, 'webcame-remote')
      }
      this.websocket.removeListner('python_client');
    });
  }

  startDetection(port: string, status: string) {
    if (!this.isDetection) {
      this.isLoading = true;
      try {
        this.progressChart.destroy();
        this.datapoints_progress = []
      } catch (e) { }

      try {
        this.locationChart.destroy();
        this.datapoints_location = []
      } catch (e) { }

      this.websocket.emit('start-detection', {
        status: status,
        port: port,
        configuration: this.localStorage.getData('paths')
      });

      this.websocket.listen('tots').subscribe(res => {
        this.frame_width = Number(res['width']);
        this.frame_height = Number(res['height']);
        this.renderProgressChart();
        this.renderLocationChart();
      });

      this.websocket.listen('progress').subscribe(res => {
        if (res['valid']) {
          this.isLoading = false;
        }
        else {
          this.stopDetection(status);
          this.websocket.removeListner('progress');
          this.openDialog('Error', res['message']);
          this.isLoading = false;
          return;
        }
      });

      this.websocket.listen('confidence_weapon').subscribe(res => {
        this.confidence_weapon = Number(res['confidence']);
      });

      this.websocket.listen('confidence_person').subscribe(res => {
        this.confidence_person = Number(res['confidence']);
      });

      this.websocket.listen('confidence_suspicious').subscribe(res => {
        if (Number(res['IoW']) > 0 && this.cnt % 5 == 0) {
          this.datapoints_location.push(res['location'])
          this.locationChart.render();
        }
        this.confidence_suspicious = Number(res['IoW']);
        this.cnt++;
      });

      this.websocket.listen('detection-started').subscribe(res => {

        this.videoURL = res['image'].toString();
        this.fps = Number(res['fps']);

        if (res['isDetection']) {
          this.datapoints_progress.push({
            x: Number(res['frames_processed']),
            y: Number(res['fps']),
            indexLabel: "SPD",
            markerType: "cross",
            markerSize: 15,
            markerColor: "red"
          });
          this.sharedDataService.addNotification({ date: res['date'] });
          this.sharedDataService.changeNotification(true);
          this.alarm.play();
        }
        if (this.counter % 20 == 0) {
          this.stripLines.push({
            value: Number(res['frames_processed']),
            thickness: 10,
            opacity: 0.1,
            color: "gray",
          });
          this.datapoints_progress.push({
            x: Number(res['frames_processed']),
            y: Number(res['fps'])
          });
          this.counter = 1;
        }
        this.progressChart.render();
        this.counter++;
      });

      this.buttonTitle = 'Stop Detection';
      this.isDetection = true;
      if (status == 'webcame-local') {
        this.buttonStyle_1 = 'button btn btn-danger';
        this.isRemoteDisabled = true;
      }
      else {
        this.buttonStyle_2 = 'button btn btn-danger';
        this.isLocalDisabled = true;
      }
    }
    else {
      this.websocket.removeListner('detection-started');
      this.stopDetection(status)
    }
  }

  renderLocationChart() {

    this.locationChart = new CanvasJS.Chart("locationChart", {
      animationEnabled: true,
      zoomEnabled: true,
      exportEnabled: true,
      height: 350,
      title: {
        text: "weapon bbox locations"
      },
      axisX: {
        title: "image width (pixels)",
        // valueFormatString: "$#,##0k",
        minimum: 0,
        maximum: this.frame_width
      },
      axisY: {
        title: "image height (pixels)",
        minimum: 0,
        maximum: this.frame_height
      },
      data: [{
        type: "scatter",
        color: "red",
        toolTipContent: "<b>x: </b>{x}<br/><b>y: </b>{y}",
        dataPoints: this.datapoints_location
      }]
    });
    this.locationChart.render();

  }

  renderProgressChart() {
    this.progressChart = new CanvasJS.Chart("progressChart", {
      animationEnabled: true,
      exportEnabled: true,
      zoomEnabled: true,
      height: 160,
      axisX: {
        title: "Frames Processed",
        titleFontSize: 16,
        stripLines: this.stripLines,
        labelFontSize: 12,

      },
      axisY: {
        title: "Detection FPS",
        titleFontSize: 16,
        minimum: 0,
        maximum: 30,
        interval: 5,
        gridColor: "grey",
        labelFontSize: 12,
        stripLines: [{
          value: 30,
          label: "Average"
        }]
      },
      data: [{
        type: "spline",
        lineColor: 'gray',
        markerColor: 'orange',
        lineThickness: 5,
        dataPoints: this.datapoints_progress,
        click: function (e) {
          alert(e.dataSeries.type + ", dataPoint { x:" + e.dataPoint.x + ", y: " + e.dataPoint.y + " }");
        },
      }]
    });
    this.progressChart.render();
  }

  stopDetection(status: string) {
    this.websocket.emit('video-command', 'exit');
    this.isDetection = false;
    this.buttonTitle = 'Start Detection';
    if (status == 'webcame-local') {
      this.buttonStyle_1 = 'button btn btn-success';
      this.isRemoteDisabled = false;
    }
    else {
      this.buttonStyle_2 = 'button btn btn-success';
      this.isLocalDisabled = false;
    }
  }

  onCommandButton(command) {
    if (this.isDetection) {
      if (command == 'record') {
        this.showRecord = true;
      }
      if (command == 'play') {
        this.showRecord = false;
      }
      if (command == 'fullscreen') {
        this.isFullScreen = true;
        return;
      }
      if (command == 'fullscreen_exit') {
        this.isFullScreen = false;
        return;
      }
      this.websocket.emit('video-command', command);
    }
    return;
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

  localStorageCheck() {
    if (this.localStorage.getData('paths') == null) {
      return false;
    }
    return true;
  }
}
