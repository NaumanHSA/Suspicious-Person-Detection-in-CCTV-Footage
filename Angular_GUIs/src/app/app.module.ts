import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './components/header/header.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { MatVideoModule } from 'mat-video';
import { FormsModule } from '@angular/forms';
import { StorageServiceModule } from 'ngx-webstorage-service';

//Mdbootstrap
import { MDBBootstrapModule } from 'angular-bootstrap-md';

//Import Angular Material Designs
import {MatSidenavModule} from '@angular/material/sidenav';
import {MatMenuModule} from '@angular/material/menu';
import {MatIconModule} from '@angular/material/icon';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatDialogModule} from '@angular/material/dialog';
import {MatSelectModule} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSliderModule} from '@angular/material/slider';


//import chart modules  
import { ChartsModule } from 'ng2-charts';
import { GaugeChartModule } from 'angular-gauge-chart'

//Import Angular Components
import { SideNavComponent } from './components/side-nav/side-nav.component';
import { LiveCamComponent } from './components/live-cam/live-cam.component';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { LoadVideoComponent } from './components/load-video/load-video.component';
import { LoadImagesComponent } from './components/load-images/load-images.component';
import { SidenavService } from './Services/side-nav.service';
import { RightSideNavComponent } from './components/right-side-nav/right-side-nav.component';


@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    SideNavComponent,
    LiveCamComponent,
    WelcomeComponent,
    LoadVideoComponent,
    LoadImagesComponent,
    RightSideNavComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatSidenavModule,
    MatMenuModule,
    MatIconModule,
    HttpClientModule,
    MatSlideToggleModule,
    MatVideoModule,
    FormsModule,
    MatProgressBarModule,
    ChartsModule,
    GaugeChartModule,
    MatTooltipModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    StorageServiceModule,
    MatProgressSpinnerModule,
    MDBBootstrapModule.forRoot(),
    MatSliderModule
  ],
  providers: [SidenavService],
  bootstrap: [AppComponent]
})
export class AppModule { }
