import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { combineLatest, Observable, timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { StateService } from '../..//services/state.service';

interface EpochProgress {
  base: string;
  change: number;
  progress: number;
  remainingBlocks: number;
  newDifficultyHeight: number;
  colorAdjustments: string;
  colorPreviousAdjustments: string;
  estimatedRetargetDate: number;
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
    this.difficultyEpoch$ = combineLatest([
      this.stateService.blocks$.pipe(map(([block]) => block)),
      this.stateService.difficultyAdjustment$,
    ])
    .pipe(
      map(([block, da]) => {
        let colorAdjustments = 'var(--transparent-fg)';
        if (da.difficultyChange > 0) {
          colorAdjustments = 'var(--green)';
        }
        if (da.difficultyChange < 0) {
          colorAdjustments = 'var(--red)';
        }

        let colorPreviousAdjustments = 'var(--red)';
        if (da.previousRetarget) {
          if (da.previousRetarget >= 0) {
            colorPreviousAdjustments = 'var(--green)';
          }
          if (da.previousRetarget === 0) {
            colorPreviousAdjustments = 'var(--transparent-fg)';
          }
        } else {
          colorPreviousAdjustments = 'var(--transparent-fg)';
        }

        const blocksUntilHalving = 210000 - (block.height % 210000);
        const timeUntilHalving = new Date().getTime() + (blocksUntilHalving * 600000);

        const data = {
          base: `${da.progressPercent.toFixed(2)}%`,
          change: da.difficultyChange,
          progress: da.progressPercent,
          remainingBlocks: da.remainingBlocks,
          colorAdjustments,
          colorPreviousAdjustments,
          newDifficultyHeight: da.nextRetargetHeight,
          estimatedRetargetDate: da.estimatedRetargetDate,
          previousRetarget: da.previousRetarget,
          blocksUntilHalving,
          timeUntilHalving,
        };
        return data;
      })
    );
  }
}
