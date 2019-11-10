import { Component, OnInit } from '@angular/core';
import { MemPoolService } from '../services/mem-pool.service';
import { Router } from '@angular/router';
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
  isEsploraEnabled = !!environment.esplora;

  constructor(
    private memPoolService: MemPoolService,
    private router: Router,
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit() {
    this.searchForm = this.formBuilder.group({
      txId: ['', Validators.pattern('^[a-fA-F0-9]{64}$')],
    });

    this.memPoolService.isOffline$
      .subscribe((state) => {
        this.isOffline = state;
      });
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }

  search() {
    const txId = this.searchForm.value.txId;
    if (txId) {
      if (window.location.pathname === '/' || window.location.pathname.substr(0, 4) === '/tx/') {
        window.history.pushState({}, '', `/tx/${txId}`);
      } else {
        this.router.navigate(['/tx/', txId]);
      }
      this.memPoolService.txIdSearch$.next(txId);
      this.searchForm.setValue({
        txId: '',
      });
      this.collapse();
    }
  }

}
