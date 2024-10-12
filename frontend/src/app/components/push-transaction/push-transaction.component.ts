import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { StateService } from '../../services/state.service';
import { SeoService } from '../../services/seo.service';
import { OpenGraphService } from '../../services/opengraph.service';
import { seoDescriptionNetwork } from '../../shared/common.utils';
import { ActivatedRoute, Router } from '@angular/router';
import { RelativeUrlPipe } from '../../shared/pipes/relative-url/relative-url.pipe';

@Component({
  selector: 'app-push-transaction',
  templateUrl: './push-transaction.component.html',
  styleUrls: ['./push-transaction.component.scss']
})
export class PushTransactionComponent implements OnInit {
  pushTxForm: UntypedFormGroup;
  error: string = '';
  txId: string = '';
  isLoading = false;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private apiService: ApiService,
    public stateService: StateService,
    private seoService: SeoService,
    private ogService: OpenGraphService,
    private route: ActivatedRoute,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
  ) { }

  ngOnInit(): void {
    this.pushTxForm = this.formBuilder.group({
      txHash: ['', Validators.required],
    });

    this.seoService.setTitle($localize`:@@meta.title.push-tx:Broadcast Transaction`);
    this.seoService.setDescription($localize`:@@meta.description.push-tx:Broadcast a transaction to the ${this.stateService.network==='liquid'||this.stateService.network==='liquidtestnet'?'Liquid':'Bitcoin'}${seoDescriptionNetwork(this.stateService.network)} network using the transaction's hash.`);
    this.ogService.setManualOgImage('tx-push.jpg');

    this.route.fragment.subscribe(async (fragment) => {
      const fragmentParams = new URLSearchParams(fragment || '');
      return this.handleColdcardPushTx(fragmentParams);
    });
  }

  async postTx(hex?: string): Promise<string> {
    this.isLoading = true;
    this.error = '';
    this.txId = '';
    return new Promise((resolve, reject) => {
      this.apiService.postTransaction$(hex || this.pushTxForm.get('txHash').value)
      .subscribe((result) => {
        this.isLoading = false;
        this.txId = result;
        this.pushTxForm.reset();
        resolve(this.txId);
      },
      (error) => {
        if (typeof error.error === 'string') {
          const matchText = error.error.replace(/\\/g, '').match('"message":"(.*?)"');
          this.error = 'Failed to broadcast transaction, reason: ' + (matchText && matchText[1] || error.error);
        } else if (error.message) {
          this.error = 'Failed to broadcast transaction, reason: ' + error.message;
        }
        this.isLoading = false;
        reject(this.error);
      });
    });
  }

  private async handleColdcardPushTx(fragmentParams: URLSearchParams): Promise<boolean> {
    // maybe conforms to Coldcard nfc-pushtx spec
    if (fragmentParams && fragmentParams.get('t')) {
      try {
        const pushNetwork = fragmentParams.get('n');

        // Redirect to the appropriate network-specific URL
        if (this.stateService.network !== '' && !pushNetwork) {
          this.router.navigateByUrl(`/pushtx#${fragmentParams.toString()}`);
          return false;
        } else if (this.stateService.network !== 'testnet' && pushNetwork === 'XTN') {
          this.router.navigateByUrl(`/testnet/pushtx#${fragmentParams.toString()}`);
          return false;
        } else if (pushNetwork === 'XRT') {
          this.error = 'Regtest is not supported';
          return false;
        } else if (pushNetwork && !['XTN', 'XRT'].includes(pushNetwork)) {
          this.error = 'Invalid network';
          return false;
        }

        const rawTx = this.base64UrlToU8Array(fragmentParams.get('t'));
        if (!fragmentParams.get('c')) {
          this.error = 'Missing checksum, URL is probably truncated';
          return false;
        }
        const rawCheck = this.base64UrlToU8Array(fragmentParams.get('c'));
        

        // check checksum
        const hashTx = await crypto.subtle.digest('SHA-256', rawTx);
        if (this.u8ArrayToHex(new Uint8Array(hashTx.slice(24))) !== this.u8ArrayToHex(rawCheck)) {
          this.error = 'Bad checksum, URL is probably truncated';
          return false;
        }

        const hexTx = this.u8ArrayToHex(rawTx);
        this.pushTxForm.get('txHash').setValue(hexTx);

        try {
          const txid = await this.postTx(hexTx);
          this.router.navigate([this.relativeUrlPipe.transform('/tx'), txid]);
        } catch (e) {
          // error already handled
          return false;
        }

        return true;
      } catch (e) {
        this.error = 'Failed to decode transaction';
        return false;
      }
    }
  }

  private base64UrlToU8Array(base64Url: string): Uint8Array {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(base64Url.length + (4 - base64Url.length % 4) % 4, '=');
    const binaryString = atob(base64);
    return new Uint8Array([...binaryString].map(char => char.charCodeAt(0)));
  }

  private u8ArrayToHex(arr: Uint8Array): string {
    return Array.from(arr).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
}
