import { Component, OnInit } from '@angular/core';
import { WebsocketService } from 'src/app/Services/websocket.service';
import { SharedDataService } from 'src/app/Services/shared-data.service';

@Component({
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.css']
})
export class WelcomeComponent implements OnInit {

  
  public images;
  public sysKey:String;
  public imageTitle:String;
  public imageUrl:any;

  constructor(public websocket: WebsocketService, public sharedDataService: SharedDataService) { }

  ngOnInit() {};

  addNoti(){
    this.sharedDataService.addNotification({date: '2/2/2010', image: 'assets/images/1.jpg'})
  }

  PreviewImage(image){}
  
  getImage(){
    return this.imageUrl;
  }
}
