import { Component, OnInit, Inject, ViewChild, ElementRef } from '@angular/core';
import { WebsocketService } from 'src/app/Services/websocket.service';
import * as CanvasJS from 'canvasjs/canvasjs.min';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { LocalStorageService } from 'src/app/Services/local-storage.service';
import { angularMath } from 'angular-ts-math';

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
  selector: 'app-load-images',
  templateUrl: './load-images.component.html',
  styleUrls: ['./load-images.component.css']
})

export class LoadImagesComponent implements OnInit {

  @ViewChild('fileInput') fileInput: ElementRef;

  isDetection = false;
  inputText = 'Choose images directory for detection';
  videoURL = '';
  images_directory = '';
  isLoading: boolean = false;
  isDisable: boolean = true;
  progress: string = '';
  configuration = {};

  datapoints = [];
  chart: any;
  y_max: number;
  images = [];
  image_index: number = 0;

  constructor(public websocket: WebsocketService,
    private dialog: MatDialog, public localStorage: LocalStorageService) { }

  ngOnInit(): void {}

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
    this.configuration = this.localStorage.getData('paths');
    if (!this.isDetection) {
      this.isLoading = true;
      try {
        this.chart.destroy();
        this.datapoints = []
      } catch (e) { }

      this.websocket.emit('start-detection', {
        status: 'images',
        port: this.images_directory,
        configuration: this.configuration
      });

      this.websocket.listen('progress').subscribe(res => {
        if (res['valid']) {
          this.progress = res['message'];
        }
        else {
          this.websocket.removeListner('progress');
          this.openDialog('Error', res['message']);
          this.isDetection = false;
          this.isLoading = false;
          return;
        }
      });

      this.websocket.listen('detection-started').subscribe(res => {
        this.datapoints = [
          { y: res['loading_batch'], label: "batches" },
          { y: res['detection'], label: "detection" },
          { y: res['drawing_boxes'], label: "drawing_bboxes" },
          { y: res['saving_photos'], label: "saving photos" },
          { y: res['average_per_image'], label: "average" },
          { y: res['results'], label: "fetching_results" }
        ]
        this.y_max = res['end_time'];
        this.images = res['images'];
        this.renderChart();

        this.websocket.removeListner('video-started');
        this.isLoading = false;
        this.isDetection = false;
      });
    }
    else {
      this.websocket.removeListner('video-started');
      this.isLoading = false;
      this.isDetection = false;
    }
  }

  renderChart() {
    this.chart = new CanvasJS.Chart("chartContainer", {
      animationEnabled: true,
      exportEnabled: true,
      zoomEnabled: true,
      height: 350,
      axisX: {
        title: 'tasks performed',
        titleFontSize: 16,
      },
      axisY: {
        title: "time",
        titleFontSize: 16,
        minimum: 0,
        maximum: this.y_max,
        gridColor: "green",
        labelFontSize: 12,
        stripLines: [{
          value: this.y_max / 2,
          // value: 50,
          label: "Average"
        }]
      },
      data: [{
        type: "column",
        dataPoints: this.datapoints
      }]
    });
    this.chart.render();
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
    let regexImage: RegExp = /image\//g;
    let isImages: boolean = false;

    for (let i = 0; i < Object.keys(event.target.files).length; i++) {
      if (regexImage.test(event.target.files[i].type)) {
        isImages = true;
      }
    }
    if (isImages && event.target.files[0]) {
      let path = event.target.files[0].path;
      this.images_directory = path.substr(0, path.lastIndexOf('\\'));
      this.inputText = this.images_directory;
      this.isDisable = false;
    }
    else {
      this.fileInput.nativeElement.value = null;
      this.inputText = 'Directory containes no images'
      this.isDisable = true;
    }
  }

  onCommandButton(command) {
    if (command == 'next') {
      this.image_index++;
      this.image_index = angularMath.getMinimum(this.image_index, this.images.length - 1)
    }
    if (command == 'previous') {
      this.image_index--;
      this.image_index = angularMath.getMaximum(this.image_index, 0)
    }
  }
}
