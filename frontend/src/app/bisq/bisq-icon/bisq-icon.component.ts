import { Component, ChangeDetectionStrategy, Input, OnChanges } from '@angular/core';
import { IconPrefix, IconName } from '@fortawesome/fontawesome-common-types';

@Component({
  selector: 'app-bisq-icon',
  templateUrl: './bisq-icon.component.html',
  styleUrls: ['./bisq-icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BisqIconComponent implements OnChanges {
  @Input() txType: string;

  iconProp: [IconPrefix, IconName] = ['fas', 'leaf'];
  color: string;

  constructor() { }

  ngOnChanges() {
    switch (this.txType) {
      case 'UNVERIFIED':
        this.iconProp[1] = 'question';
        this.color = 'ffac00';
        break;
      case 'INVALID':
        this.iconProp[1] = 'exclamation-triangle';
        this.color = 'ff4500';
        break;
      case 'GENESIS':
        this.iconProp[1] = 'rocket';
        this.color = '25B135';
        break;
      case 'TRANSFER_BSQ':
        this.iconProp[1] = 'retweet';
        this.color = 'a3a3a3';
        break;
      case 'PAY_TRADE_FEE':
        this.iconProp[1] = 'leaf';
        this.color = '689f43';
        break;
      case 'PROPOSAL':
        this.iconProp[1] = 'file-alt';
        this.color = '6c8b3b';
        break;
      case 'COMPENSATION_REQUEST':
        this.iconProp[1] = 'money-bill';
        this.color = '689f43';
        break;
      case 'REIMBURSEMENT_REQUEST':
        this.iconProp[1] = 'money-bill';
        this.color = '04a908';
        break;
      case 'BLIND_VOTE':
        this.iconProp[1] = 'eye-slash';
        this.color = '07579a';
        break;
      case 'VOTE_REVEAL':
        this.iconProp[1] = 'eye';
        this.color = '4AC5FF';
        break;
      case 'LOCKUP':
        this.iconProp[1] = 'lock';
        this.color = '0056c4';
        break;
      case 'UNLOCK':
        this.iconProp[1] = 'lock-open';
        this.color = '1d965f';
        break;
      case 'ASSET_LISTING_FEE':
        this.iconProp[1] = 'file-alt';
        this.color = '6c8b3b';
        break;
      case 'PROOF_OF_BURN':
        this.iconProp[1] = 'file-alt';
        this.color = '6c8b3b';
        break;
      default:
        this.iconProp[1] = 'question';
        this.color = 'ffac00';
    }
    // @ts-ignore
    this.iconProp = this.iconProp.slice();
  }
}
