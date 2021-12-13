import { Injectable } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  constructor(private router: Router, private route: ActivatedRoute) {
    let graphWindowPreference: string = this.getValue('graphWindowPreference');
    if (graphWindowPreference === null) { // First visit to mempool.space
      if (this.router.url.includes("graphs")) {
        this.setValue('graphWindowPreference', this.route.snapshot.fragment ? this.route.snapshot.fragment : "2h");
      } else {
        this.setValue('graphWindowPreference', "2h");
      }
    } else if (this.router.url.includes("graphs")) { // Visit a different graphs#fragment from last visit
        if (this.route.snapshot.fragment !== null && graphWindowPreference !== this.route.snapshot.fragment) {
          this.setValue('graphWindowPreference', this.route.snapshot.fragment);
        }
      }
  }

  getValue(key: string): string {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.log(e);
      return '';
    }
  }

  setValue(key: string, value: any): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.log(e);
    }
  }
}
