import { Component, OnInit } from '@angular/core';
import { MemPoolService } from './services/mem-pool.service';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  navCollapsed = false;
  isOffline = false;
  searchForm: FormGroup;

  constructor(
    private memPoolService: MemPoolService,
    private router: Router,
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit() {
    this.searchForm = this.formBuilder.group({
      txId: ['', Validators.pattern('^[a-fA-F0-9]{64}$')],
    });

    this.memPoolService.isOffline
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
      this.memPoolService.txIdSearch.next(txId);
      this.searchForm.setValue({
        txId: '',
      });
      this.collapse();
    }
  }
}
