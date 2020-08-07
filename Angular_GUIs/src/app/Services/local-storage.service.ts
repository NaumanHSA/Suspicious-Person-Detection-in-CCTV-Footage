import { Injectable, Inject } from '@angular/core';
import { LOCAL_STORAGE, StorageService } from 'ngx-webstorage-service';

export interface DetectionConfiguration {
  output_path: string,
  cfg: string,
  weights: string
  confidence: number,
  NMS: number,
  res: number,
  batch_size: number,
  IoW: number,
  classes: string
}

@Injectable({
  providedIn: 'root'
})
export class LocalStorageService {

  constructor(@Inject(LOCAL_STORAGE) private storage: StorageService) { }

  storeData(STORAGE_KEY: string, data: DetectionConfiguration): boolean {
    this.storage.remove(STORAGE_KEY);
    this.storage.set(STORAGE_KEY, data);
    return true;
  }

  getData(STORAGE_KEY: string){
    return this.storage.get(STORAGE_KEY) || null;
  }

  removeData(STORAGE_KEY: string){
    this.storage.remove(STORAGE_KEY);
    return true;
  }
}
