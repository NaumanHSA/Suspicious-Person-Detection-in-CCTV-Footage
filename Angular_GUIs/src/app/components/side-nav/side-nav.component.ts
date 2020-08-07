import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-side-nav',
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.css']
})
export class SideNavComponent implements OnInit {

  @ViewChild('home') public home_element: ElementRef;
  @ViewChild('camera') public camera_element: ElementRef;
  @ViewChild('video') public video_element: ElementRef;
  @ViewChild('images') public images_element: ElementRef;

  constructor() {}

  ngOnInit(): void {}

  onClick(command){
    if(command == 'home') {
      this.home_element.nativeElement.style.background = 'gray';
      this.camera_element.nativeElement.style.background = '#222';
      this.video_element.nativeElement.style.background = '#222';
      this.images_element.nativeElement.style.background = '#222';
    }
    if(command == 'camera') {
      this.home_element.nativeElement.style.background = '#222';
      this.camera_element.nativeElement.style.background = 'gray';
      this.video_element.nativeElement.style.background = '#222';
      this.images_element.nativeElement.style.background = '#222';
    }
    if(command == 'video') {
      this.home_element.nativeElement.style.background = '#222';
      this.camera_element.nativeElement.style.background = '#222';
      this.video_element.nativeElement.style.background = 'gray';
      this.images_element.nativeElement.style.background = '#222';
    }
    if(command == 'images') {
      this.home_element.nativeElement.style.background = '#222';
      this.camera_element.nativeElement.style.background = '#222';
      this.video_element.nativeElement.style.background = '#222';
      this.images_element.nativeElement.style.background = 'gray';
    }
  }

}
