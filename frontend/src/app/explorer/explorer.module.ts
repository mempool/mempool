import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExplorerComponent } from './explorer/explorer.component';
import { TransactionComponent } from './transaction/transaction.component';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { BlockComponent } from './block/block.component';
import { AddressComponent } from './address/address.component';

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
  declarations: [ExplorerComponent, TransactionComponent, BlockComponent, AddressComponent],
  imports: [
    SharedModule,
    CommonModule,
    RouterModule.forChild(routes),
  ]
})
export class ExplorerModule { }
