import { Component, Input } from '@angular/core';
import { Block, Transaction } from '../../interfaces/electrs.interface';

@Component({
  selector: 'app-block-details',
  templateUrl: './block-details.component.html',
  styleUrls: ['./block-details.component.scss']
})


export class BlockDetailsComponent {
  network = '';
  blockSubsidy: number;
  fees: number;
  coinbaseTx: Transaction;

  constructor( ) { }

  @Input() block: Block;

  ngOnChanges()
  {

    if (this.block.coinbaseTx) {
      this.coinbaseTx = this.block.coinbaseTx;
    }
    this.setBlockSubsidy();
    console.log(this.block.reward )
    if (this.block.reward !== undefined) {
      this.fees = this.block.reward / 100000000 - this.blockSubsidy;
     
    }
  }

  setBlockSubsidy() {
    if (this.network === 'liquid') {
      this.blockSubsidy = 0;
      return;
    }
    this.blockSubsidy = 50;
    let halvenings = Math.floor(this.block.height / 210000);
    while (halvenings > 0) {
      this.blockSubsidy = this.blockSubsidy / 2;
      halvenings--;
    }
  }

}

