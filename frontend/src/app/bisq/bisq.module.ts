import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BisqRoutingModule } from './bisq.routing.module';
import { SharedModule } from '../shared/shared.module';
import { BisqTransactionsComponent } from './bisq-transactions/bisq-transactions.component';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { BisqTransactionComponent } from './bisq-transaction/bisq-transaction.component';
import { BisqBlockComponent } from './bisq-block/bisq-block.component';
import { BisqIconComponent } from './bisq-icon/bisq-icon.component';
import { BisqTransactionDetailsComponent } from './bisq-transaction-details/bisq-transaction-details.component';
import { BisqTransfersComponent } from './bisq-transfers/bisq-transfers.component';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faLeaf, faQuestion, faExclamationTriangle, faRocket, faRetweet, faFileAlt, faMoneyBill,
  faEye, faEyeSlash, faLock, faLockOpen } from '@fortawesome/free-solid-svg-icons';
import { BisqBlocksComponent } from './bisq-blocks/bisq-blocks.component';
import { BisqExplorerComponent } from './bisq-explorer/bisq-explorer.component';

@NgModule({
  declarations: [
    BisqTransactionsComponent,
    BisqTransactionComponent,
    BisqBlockComponent,
    BisqTransactionComponent,
    BisqIconComponent,
    BisqTransactionDetailsComponent,
    BisqTransfersComponent,
    BisqBlocksComponent,
    BisqExplorerComponent,
  ],
  imports: [
    CommonModule,
    BisqRoutingModule,
    SharedModule,
    NgbPaginationModule,
    FontAwesomeModule,
  ],
})
export class BisqModule {
  constructor(library: FaIconLibrary) {
    library.addIcons(faQuestion);
    library.addIcons(faExclamationTriangle);
    library.addIcons(faRocket);
    library.addIcons(faRetweet);
    library.addIcons(faLeaf);
    library.addIcons(faFileAlt);
    library.addIcons(faMoneyBill);
    library.addIcons(faEye);
    library.addIcons(faEyeSlash);
    library.addIcons(faLock);
    library.addIcons(faLockOpen);
  }
}
