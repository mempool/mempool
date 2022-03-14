import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { specialBlocks } from 'src/app/app.constants';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
})
export class StartComponent implements OnInit {
  interval = 60;
  colors = ['#5E35B1', '#ffffff'];

  countdown = 0;
  specialEvent = false;
  eventName = '';
  mouseDragStartX: number;
  blockchainScrollLeftInit: number;
  @ViewChild('blockchainContainer') blockchainContainer: ElementRef;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.stateService.blocks$
      .subscribe((blocks: any) => {
        if (this.stateService.network !== '') {
          return;
        }
        this.countdown = 0;
        const block = blocks[0];

        for (const sb in specialBlocks) {
          const height = parseInt(sb, 10);
          const diff = height - block.height;
          if (diff > 0 && diff <= 1008) {
            this.countdown = diff;
            this.eventName = specialBlocks[sb].labelEvent;
          }
        }
        if (specialBlocks[block.height]) {
          this.specialEvent = true;
          this.eventName = specialBlocks[block.height].labelEventCompleted;
          setTimeout(() => {
            this.specialEvent = false;
          }, 60 * 60 * 1000);
        }
      });
  }

  onMouseDown(event: MouseEvent) {
    this.mouseDragStartX = event.clientX;
    this.blockchainScrollLeftInit = this.blockchainContainer.nativeElement.scrollLeft;
  }
  onDragStart(event: MouseEvent) { // Ignore Firefox annoying default drag behavior
    event.preventDefault();
  }

  // We're catching the whole page event here because we still want to scroll blocks
  // even if the mouse leave the blockchain blocks container. Same idea for mouseup below.
  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.mouseDragStartX != null) {
      this.stateService.setBlockScrollingInProgress(true);
      this.blockchainContainer.nativeElement.scrollLeft =
        this.blockchainScrollLeftInit + this.mouseDragStartX - event.clientX
    }
  }
  @HostListener('document:mouseup', [])
  onMouseUp() {
    this.mouseDragStartX = null;
    this.stateService.setBlockScrollingInProgress(false);
  }
}
