import { Component, OnInit } from '@angular/core';
import { MemPoolService } from '../services/mem-pool.service';
import { Router, NavigationEnd } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-master-page',
  templateUrl: './master-page.component.html',
  styleUrls: ['./master-page.component.scss']
})
export class MasterPageComponent implements OnInit {
  navCollapsed = false;
  isOffline = false;
  searchForm: FormGroup;
  isElectrsEnabled = !!environment.electrs;
  currentBaseRoot = '';

  regexAddr = /^([a-km-zA-HJ-NP-Z1-9]{26,35}|[a-km-zA-HJ-NP-Z1-9]{80}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,87})$/;

  constructor(
    private memPoolService: MemPoolService,
    private router: Router,
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit() {
    this.searchForm = this.formBuilder.group({
      txId: [''],
    });

    this.memPoolService.isOffline$
      .subscribe((state) => {
        this.isOffline = state;
      });

      this.currentBaseRoot = this.router.url.split('/')[1];
      this.router.events.subscribe((event) => {
        if (event instanceof NavigationEnd ) {
          this.currentBaseRoot = event.url.split('/')[1];
        }
    });
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }

  search() {
    const searchText = this.searchForm.value.txId;
    if (searchText) {
      if (this.currentBaseRoot === 'explorer') {
        if (this.regexAddr.test(searchText)) {
          this.router.navigate(['/explorer/address/', searchText]);
        } else {
          this.router.navigate(['/explorer/tx/', searchText]);
        }
      } else {
        if (window.location.pathname === '/' || window.location.pathname.substr(0, 4) === '/tx/') {
          window.history.pushState({}, '', `/tx/${searchText}`);
        } else {
          this.router.navigate(['/tx/', searchText]);
        }
        this.memPoolService.txIdSearch$.next(searchText);
      }
      this.searchForm.setValue({
        txId: '',
      });
      this.collapse();
    }
  }

}
