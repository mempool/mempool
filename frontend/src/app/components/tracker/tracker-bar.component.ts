import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';

export type TrackerStage = 'waiting' | 'pending' | 'soon' | 'next' | 'confirmed' | 'replaced';

@Component({
  selector: 'app-tracker-bar',
  templateUrl: './tracker-bar.component.html',
  styleUrls: ['./tracker-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrackerBarComponent implements OnInit, OnChanges {
  @Input() stage: TrackerStage = 'waiting';

  transitionsEnabled: boolean = false;
  
  stages = {
    waiting: {
      state: 'blank',
    },
    pending: {
      state: 'blank',
    },
    soon: {
      state: 'blank',
    },
    next: {
      state: 'blank',
    },
    confirmed: {
      state: 'blank',
    },
  };
  stageOrder: TrackerStage[] = ['waiting', 'pending', 'soon', 'next', 'confirmed'];

  constructor (
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.setStage();
    setTimeout(() => {
      this.transitionsEnabled = true;
    }, 100)
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.stage) {
      this.setStage();
    }
  }

  setStage() {
    let matched = 0;
    for (let stage of this.stageOrder) {
      if (stage === this.stage) {
        this.stages[stage].state = 'current';
        matched = 1;
      } else {
        if (matched > 1) {
          this.stages[stage].state = 'blank';
        } else if (matched) {
          this.stages[stage].state = 'next';
          matched++;
        } else {
          this.stages[stage].state = 'done';
        }
      }
    }
    this.stages = this.stages;
    this.cd.markForCheck();
  }
}