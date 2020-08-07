import { Component, OnInit, Inject } from '@angular/core';
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
  selector: 'app-load-video',
  templateUrl: './load-video.component.html',
  styleUrls: ['./load-video.component.css']
})

export class LoadVideoComponent implements OnInit {

  buttonTitle: string = 'Start Detection';
  isDetection: boolean = false;
  inputText: string = 'Please Choose a Video';
  videoURL: string = '';
  videoPath: string = '';
  playStopButtonStyle: string = 'button btn btn-success';
  isLoading: boolean = false;
  isDisable: boolean = true;
  isFullScreen: boolean = false;
  confidence_weapon: number = 0;
  confidence_person: number = 0;
  confidence_suspicious: number = 0;

  datapoints_progress = [];
  datapoints_location = [];
  progressChart: any;
  locationChart: any;
  counter: number = 0;
  tots: number = 0;
  fps: number = 0;
  frame_number: number = 0;
  stripLines = [];
  frame_width: number = 0;
  frame_height: number = 0;
  cnt: number = 0;

  alarm = new Audio();

  constructor(public websocket: WebsocketService, private sharedDataService: SharedDataService,
    private dialog: MatDialog, public localStorage: LocalStorageService) { }

  ngOnInit(): void {
    this.alarm.src = "./assets/audio/alarm.mp3";
    this.alarm.load();
  }

  onDetectionButton() {
    this.websocket.emit('python_client', true);
    this.websocket.listen('python_client').subscribe(res => {
      if (!res) {
        this.openDialog('Error', 'There was no response from backend python script. Python client is not connected. Run python scripts first to establish connection');
      }
      else {
        this.startDetection();
      }
      this.websocket.removeListner('python_client');
    });
  }

  startDetection() {
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

      this.websocket.listen('tots').subscribe(res => {
        this.tots = Number(res['tots']);
        this.frame_width = Number(res['width']);
        this.frame_height = Number(res['height']);
        this.renderProgressChart();
        this.renderLocationChart();
      });

      this.websocket.emit('start-detection', {
        status: 'video',
        port: this.videoPath,
        configuration: this.localStorage.getData('paths')
      });

      this.websocket.listen('progress').subscribe(res => {
        if (res['valid']) {
          this.isLoading = false;
        }
        else {
          this.stopDetection();
          this.websocket.removeListner('progress');
          this.openDialog('Error', res['message']);
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
        this.frame_number = Number(res['frames_processed']);

        if (res['isDetection']) {
          this.datapoints_progress.push({
            x: this.frame_number,
            y: this.fps,
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
            value: this.frame_number,
            thickness: 10,
            opacity: 0.1,
            color: "gray",
          });
          this.datapoints_progress.push({
            x: this.frame_number,
            y: this.fps
          });
          this.counter = 1;
        }
        this.progressChart.render();
        this.counter++;
      });

      this.buttonTitle = 'Stop Detection';
      this.isDetection = true;
      this.playStopButtonStyle = 'button btn btn-danger';
    }
    else {
      this.stopDetection()
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
        maximum: this.tots,
        stripLines: this.stripLines,
        labelFontSize: 12,

      },
      axisY: {
        title: "Detection FPS",
        titleFontSize: 16,
        maximum: 30,
        minimum: 0,
        interval: 10,
        gridColor: "grey",
        labelFontSize: 12,
        stripLines: [{
          value: 10,
          label: "Average"
        }]
      },
      data: [{
        type: "line",
        lineColor: 'grey',
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

  stopDetection() {
    this.websocket.emit('video-command', 'exit');
    this.websocket.removeListner('detection-started');
    this.isDetection = false;
    this.buttonTitle = 'Start Detection';
    this.playStopButtonStyle = 'button btn btn-success';
    this.isLoading = false;
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

  handleUpload(event) {
    this.inputText = '';
    let regexpNumber: RegExp = /video\//g;

    if (regexpNumber.test(event.target.files[0].type)) {
      this.videoPath = event.target.files[0].path;
      this.inputText = event.target.files[0].path
      this.isDisable = false;
    }
    else {
      this.openDialog('Error', 'Please Select a video file');
      this.inputText = 'Choose a video file';
      this.isDisable = true;
    }
    return;
  }

  onCommandButton(command) {
    if (this.isDetection) {
      if (command == 'fullscreen') {
        this.isFullScreen = true;
      }
      if (command == 'fullscreen_exit') {
        this.isFullScreen = false;
      }
      this.websocket.emit('video-command', command);
    }
  }

  onSliderClick() {
    if (this.isDetection) {
      this.websocket.emit('video-command', this.frame_number);
    }
  }
}
