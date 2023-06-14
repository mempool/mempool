import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators, FormArray } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-push-transaction',
  templateUrl: './push-transaction.component.html',
  styleUrls: ['./push-transaction.component.scss']
})
export class PushTransactionComponent implements OnInit {
  pushTxForm: UntypedFormGroup;
  error: string = '';
  txIds: string[] = [];
  isLoading = false;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private apiService: ApiService,
  ) { }

  ngOnInit(): void {
    this.pushTxForm = this.formBuilder.group({
      txHash: this.formBuilder.array([]),
    });

    this.addTx();
  }

  getTxs() {
    return this.pushTxForm.get('txHash') as FormArray;
  }

  addTx() {
    this.getTxs().push(this.formBuilder.control('', Validators.required))
  }

  postTx() {
    this.isLoading = true;
    this.error = '';
    this.txIds = [];
    const txs = this.pushTxForm.get('txHash').value;
    const txData = txs.join(' ');
    this.apiService.postTransaction$(txData)
      .subscribe((result) => {
        this.isLoading = false;
        this.txIds = result;
        this.pushTxForm.reset();
      },
      (error) => {
        if (typeof error.error === 'string') {
          const matchText = error.error.match('"message":"(.*?)"');
          this.error = matchText && matchText[1] || error.error;
        } else if (error.message) {
          this.error = error.message;
        }
        this.isLoading = false;
      });
  }

}
