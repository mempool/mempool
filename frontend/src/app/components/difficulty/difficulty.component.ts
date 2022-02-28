import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { combineLatest, Observable, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StateService } from '../..//services/state.service';

interface EpochProgress {
  base: string;
  change: number;
  progress: string;
  remainingBlocks: number;
  newDifficultyHeight: number;
  colorAdjustments: string;
  colorPreviousAdjustments: string;
  timeAvg: string;
  remainingTime: number;
  previousRetarget: number;
  blocksUntilHalving: number;
  timeUntilHalving: number;
}

@Component({
  selector: 'app-difficulty',
  templateUrl: './difficulty.component.html',
  styleUrls: ['./difficulty.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultyComponent implements OnInit {
  isLoadingWebSocket$: Observable<boolean>;
  difficultyEpoch$: Observable<EpochProgress>;

  @Input() showProgress = true;
  @Input() showHalving = false;
  @Input() showTitle = true;

  constructor(
    public stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.difficultyEpoch$ = timer(0, 1000)
      .pipe(
        switchMap(() => combineLatest([
          this.stateService.blocks$.pipe(map(([block]) => block)),
          this.stateService.lastDifficultyAdjustment$,
          this.stateService.previousRetarget$
        ])),
        map(([block, DATime, previousRetarget]) => {
          const now = new Date().getTime() / 1000;
          const diff = now - DATime;
          const blocksInEpoch = block.height % 2016;
          const progress = (blocksInEpoch >= 0) ? (blocksInEpoch / 2016 * 100).toFixed(2) : `100`;
          const remainingBlocks = 2016 - blocksInEpoch;
          const newDifficultyHeight = block.height + remainingBlocks;

          let change = 0;
          if (remainingBlocks < 1870) {
            if (blocksInEpoch > 0) {
              change = (600 / (diff / blocksInEpoch ) - 1) * 100;
            }
            if (change > 300) {
              change = 300;
            }
            if (change < -75) {
              change = -75;
            }
          }

          const timeAvgDiff = change * 0.1;

          let timeAvgMins = 10;
          if (timeAvgDiff > 0) {
            timeAvgMins -= Math.abs(timeAvgDiff);
          } else {
            timeAvgMins += Math.abs(timeAvgDiff);
          }

          const timeAvg = timeAvgMins.toFixed(0);
          const remainingTime = (remainingBlocks * timeAvgMins * 60 * 1000) + (now * 1000);

          let colorAdjustments = '#ffffff66';
          if (change > 0) {
            colorAdjustments = '#3bcc49';
          }
          if (change < 0) {
            colorAdjustments = '#dc3545';
          }

          let colorPreviousAdjustments = '#dc3545';
          if (previousRetarget) {
            if (previousRetarget >= 0) {
              colorPreviousAdjustments = '#3bcc49';
            }
            if (previousRetarget === 0) {
              colorPreviousAdjustments = '#ffffff66';
            }
          } else {
            colorPreviousAdjustments = '#ffffff66';
          }

          const blocksUntilHalving = block.height % 210000;
          const timeUntilHalving = (blocksUntilHalving * timeAvgMins * 60 * 1000) + (now * 1000);

          return {
            base: `${progress}%`,
            change,
            progress,
            remainingBlocks,
            timeAvg,
            colorAdjustments,
            colorPreviousAdjustments,
            blocksInEpoch,
            newDifficultyHeight,
            remainingTime,
            previousRetarget,
            blocksUntilHalving,
            timeUntilHalving,
          };
        })
      );
  }
}
