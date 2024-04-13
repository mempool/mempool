import { Component, OnInit, OnDestroy, Output, EventEmitter, Input } from '@angular/core';
import { Transaction } from '../../interfaces/electrs.interface';
import { MempoolPosition } from '../../interfaces/node-api.interface';

@Component({
  selector: 'app-accelerate-checkout',
  templateUrl: './accelerate-checkout.component.html',
  styleUrls: ['./accelerate-checkout.component.scss']
})
export class AccelerateCheckout implements OnInit, OnDestroy {
  @Input() tx: Transaction ;
  @Input() eta: number;
  @Output() close = new EventEmitter<null>();

  constructor() {
  }

  ngOnInit() {
  }

  ngOnDestroy() {
  }

  closeModal(): void {
    console.log('close modal')
    this.close.emit();
  }
}
