import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { LiveCamComponent } from './components/live-cam/live-cam.component';
import { WelcomeComponent } from './components/welcome/welcome.component';
import { LoadVideoComponent } from './components/load-video/load-video.component';
import { LoadImagesComponent } from './components/load-images/load-images.component';


const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    component: WelcomeComponent,
  },
  {
    path: 'live-camera',
    component: LiveCamComponent
  },
  {
    path: 'load-video',
    component: LoadVideoComponent,
  },
  {
    path: 'load-images',
    component: LoadImagesComponent,
  },
  // {
  //   path: 'user',
  //   component: UserComponent,
  //   loadChildren: () => import('./user/user.module').then(m => m.UserModule)
  // },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
