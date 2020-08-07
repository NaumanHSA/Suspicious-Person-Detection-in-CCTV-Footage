import { Injectable } from '@angular/core';
import * as io from 'socket.io-client';
import {Observable, Subscriber} from "rxjs";

@Injectable({
  providedIn: 'root'
})

export class WebsocketService {

  socket : any;
  readonly url : string = 'ws://localhost:9009';

  constructor() {
    this.socket = io(this.url);
   }

   listen(event : string){
     return new Observable(subscriber => {
       this.socket.on(event, data => {
         subscriber.next(data)
       });
     });
   }

   emit(event : string, data : any){
    this.socket.emit(event, data)
   }

   removeListner(event: string){
     this.socket.off(event);
   }
}
