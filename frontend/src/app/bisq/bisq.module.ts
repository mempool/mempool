import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BisqRoutingModule } from './bisq.routing.module';
import { SharedModule } from '../shared/shared.module';
import { BisqTransactionsComponent } from './bisq-transactions/bisq-transactions.component';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

@NgModule({
  declarations: [
    BisqTransactionsComponent,
  ],
  imports: [
    CommonModule,
    BisqRoutingModule,
    SharedModule,
    NgbPaginationModule,
  ],
})
export class BisqModule { }
