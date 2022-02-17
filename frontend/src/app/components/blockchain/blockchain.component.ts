import { Component, OnInit, ChangeDetectionStrategy, Input, ViewChild, ElementRef } from '@angular/core';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-blockchain',
  templateUrl: './blockchain.component.html',
  styleUrls: ['./blockchain.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockchainComponent implements OnInit {
  @Input() miningInfo: boolean = false;
  @ViewChild('container') container: ElementRef;
  network: string;

  constructor(
    public stateService: StateService,
  ) {}

  ngOnInit() {
    this.network = this.stateService.network;

    setTimeout(() => {
      if (this.miningInfo) {
        this.container.nativeElement.className += ' move-left';
        this.stateService.blockShifted = true;
      } else if (this.stateService.blockShifted) {
        this.container.nativeElement.className = this.container.nativeElement.className.replace(' move-left', '');
        this.stateService.blockShifted = false;
      }
    }, 250);
  }
}
