import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { TestMempoolAcceptResult } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-test-transactions',
  templateUrl: './test-transactions.component.html',
  styleUrls: ['./test-transactions.component.scss']
})
export class TestTransactionsComponent implements OnInit {
  testTxsForm: UntypedFormGroup;
  error: string = '';
  results: TestMempoolAcceptResult[] = [];
  isLoading = false;
  invalidMaxfeerate = false;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private apiService: ApiService,
    public stateService: StateService,
    private seoService: SeoService,
    private ogService: OpenGraphService,
  ) { }

  ngOnInit(): void {
    this.testTxsForm = this.formBuilder.group({
      txs: ['', Validators.required],
      maxfeerate: ['', Validators.min(0)]
    });

    this.seoService.setTitle($localize`:@@f74d6f23e06c5a75d95a994017c00191c162ba9f:Test Transactions`);
    this.ogService.setManualOgImage('tx-push.jpg');
  }

  testTxs() {
    let txs: string[] = [];
    try {
      txs = (this.testTxsForm.get('txs')?.value as string).split(',').map(hex => hex.trim());
      if (!txs?.length) {
        this.error = 'At least one transaction is required';
        return;
      } else if (txs.length > 25) {
        this.error = 'Exceeded maximum of 25 transactions';
        return;
      }
    } catch (e) {
      this.error = e?.message;
      return;
    }

    let maxfeerate;
    this.invalidMaxfeerate = false;
    try {
      const maxfeerateVal = this.testTxsForm.get('maxfeerate')?.value;
      if (maxfeerateVal != null && maxfeerateVal !== '') {
        maxfeerate = parseFloat(maxfeerateVal) / 100_000;
      }
    } catch (e) {
      this.invalidMaxfeerate = true;
    }

    this.isLoading = true;
    this.error = '';
    this.results = [];
    this.apiService.testTransactions$(txs, maxfeerate === 0.1 ? null : maxfeerate)
      .subscribe((result) => {
        this.isLoading = false;
        this.results = result || [];
        this.testTxsForm.reset();
      },
      (error) => {
        if (typeof error.error === 'string') {
          const matchText = error.error.replace(/\\/g, '').match('"message":"(.*?)"');
          this.error = matchText && matchText[1] || error.error;
        } else if (error.message) {
          this.error = error.message;
        }
        this.isLoading = false;
      });
  }

}
