import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeModule } from 'angularx-qrcode';
import { ExplorerComponent } from './explorer/explorer.component';
import { TransactionComponent } from './transaction/transaction.component';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { BlockComponent } from './block/block.component';
import { AddressComponent } from './address/address.component';
import { TransactionsListComponent } from './transactions-list/transactions-list.component';

const routes: Routes = [
  {
    path: '',
    component: ExplorerComponent,
  },
  {
    path: 'block/:id',
    component: BlockComponent,
  },
  {
    path: 'tx/:id',
    component: TransactionComponent,
  },
  {
    path: 'address/:id',
    component: AddressComponent,
  },
];

@NgModule({
  declarations: [ExplorerComponent, TransactionComponent, BlockComponent, AddressComponent, TransactionsListComponent],
  imports: [
    SharedModule,
    CommonModule,
    RouterModule.forChild(routes),
    QRCodeModule,
  ]
})
export class ExplorerModule { }
