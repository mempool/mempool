import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-push-transaction',
  templateUrl: './push-transaction.component.html',
  styleUrls: ['./push-transaction.component.scss']
})
export class PushTransactionComponent implements OnInit {
  pushTxForm: FormGroup;
  error: string = '';
  txId: string = '';
  isLoading = false;

  constructor(
    private formBuilder: FormBuilder,
    private apiService: ApiService,
  ) { }

  ngOnInit(): void {
    this.pushTxForm = this.formBuilder.group({
      txHash: ['', Validators.required],
    });
  }

  postTx() {
    this.isLoading = true;
    this.error = '';
    this.txId = '';
    this.apiService.postTransaction$(this.pushTxForm.get('txHash').value)
      .subscribe((result) => {
        this.isLoading = false;
        this.txId = result;
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
