import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, ElementRef, ViewChild, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';

interface EpochProgress {
  base: string;
  change: number;
  progress: number;
  minedBlocks: number;
  remainingBlocks: number;
  expectedBlocks: number;
  newDifficultyHeight: number;
  colorAdjustments: string;
  colorPreviousAdjustments: string;
  estimatedRetargetDate: number;
  retargetDateString: string;
  previousRetarget: number;
  blocksUntilHalving: number;
  timeUntilHalving: number;
  timeAvg: number;
  adjustedTimeAvg: number;
}

type BlockStatus = 'mined' | 'behind' | 'ahead' | 'next' | 'remaining';

interface DiffShape {
  x: number;
  y: number;
  w: number;
  h: number;
  status: BlockStatus;
  expected: boolean;
}

const EPOCH_BLOCK_LENGTH = 2016; // Bitcoin mainnet

@Component({
  selector: 'app-difficulty',
  templateUrl: './difficulty.component.html',
  styleUrls: ['./difficulty.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultyComponent implements OnInit {
  @Input() showProgress = true;
  @Input() showHalving = false;
  @Input() showTitle = true;

  @ViewChild('epochSvg') epochSvgElement: ElementRef<SVGElement>;
 
  isLoadingWebSocket$: Observable<boolean>;
  difficultyEpoch$: Observable<EpochProgress>;

  mode: 'difficulty' | 'halving' = 'difficulty';
  userSelectedMode: boolean = false;

  now: number = Date.now();
  epochStart: number;
  currentHeight: number;
  currentIndex: number;
  expectedHeight: number;
  expectedIndex: number;
  difference: number;
  shapes: DiffShape[];
  nextSubsidy: number;

  tooltipPosition = { x: 0, y: 0 };
  hoverSection: DiffShape | void;

  constructor(
    public stateService: StateService,
    private cd: ChangeDetectorRef,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit(): void {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.difficultyEpoch$ = combineLatest([
      this.stateService.blocks$,
      this.stateService.difficultyAdjustment$,
    ])
    .pipe(
      map(([blocks, da]) => {
        const maxHeight = blocks.reduce((max, block) => Math.max(max, block.height), 0);
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

        const blocksUntilHalving = 210000 - (maxHeight % 210000);
        const timeUntilHalving = new Date().getTime() + (blocksUntilHalving * 600000);
        const newEpochStart = Math.floor(this.stateService.latestBlockHeight / EPOCH_BLOCK_LENGTH) * EPOCH_BLOCK_LENGTH;
        const newExpectedHeight = Math.floor(newEpochStart + da.expectedBlocks);
        this.now = new Date().getTime();
        this.nextSubsidy = getNextBlockSubsidy(maxHeight);

        if (blocksUntilHalving < da.remainingBlocks && !this.userSelectedMode) {
          this.mode = 'halving';
        }

        if (newEpochStart !== this.epochStart || newExpectedHeight !== this.expectedHeight || this.currentHeight !== this.stateService.latestBlockHeight) {
          this.epochStart = newEpochStart;
          this.expectedHeight = newExpectedHeight;
          this.currentHeight = this.stateService.latestBlockHeight;
          this.currentIndex = this.currentHeight - this.epochStart;
          this.expectedIndex = Math.min(this.expectedHeight - this.epochStart, 2016) - 1;
          this.difference = this.currentIndex - this.expectedIndex;

          this.shapes = [];
          this.shapes = this.shapes.concat(this.blocksToShapes(
            0, Math.min(this.currentIndex, this.expectedIndex), 'mined', true
          ));
          this.shapes = this.shapes.concat(this.blocksToShapes(
            this.currentIndex + 1, this.expectedIndex, 'behind', true
          ));
          this.shapes = this.shapes.concat(this.blocksToShapes(
            this.expectedIndex + 1, this.currentIndex, 'ahead', false
          ));
          if (this.currentIndex < 2015) {
            this.shapes = this.shapes.concat(this.blocksToShapes(
              this.currentIndex + 1, this.currentIndex + 1, 'next', (this.expectedIndex > this.currentIndex)
            ));
          }
          this.shapes = this.shapes.concat(this.blocksToShapes(
            Math.max(this.currentIndex + 2, this.expectedIndex + 1), 2105, 'remaining', false
          ));
        }


        let retargetDateString;
        if (da.remainingBlocks > 1870) {
          retargetDateString = (new Date(da.estimatedRetargetDate)).toLocaleDateString(this.locale, { month: 'long', day: 'numeric' });
        } else {
          retargetDateString = (new Date(da.estimatedRetargetDate)).toLocaleTimeString(this.locale, { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
        }

        const data = {
          base: `${da.progressPercent.toFixed(2)}%`,
          change: da.difficultyChange,
          progress: da.progressPercent,
          minedBlocks: this.currentIndex,
          remainingBlocks: da.remainingBlocks,
          expectedBlocks: Math.floor(da.expectedBlocks),
          colorAdjustments,
          colorPreviousAdjustments,
          newDifficultyHeight: da.nextRetargetHeight,
          estimatedRetargetDate: da.estimatedRetargetDate,
          retargetDateString,
          previousRetarget: da.previousRetarget,
          blocksUntilHalving,
          timeUntilHalving,
          timeAvg: da.timeAvg,
          adjustedTimeAvg: da.adjustedTimeAvg,
        };
        return data;
      })
    );
  }

  blocksToShapes(start: number, end: number, status: BlockStatus, expected: boolean = false): DiffShape[] {
    const startY = start % 9;
    const startX = Math.floor(start / 9);
    const endY = (end % 9);
    const endX = Math.floor(end / 9);

    if (startX > endX) {
      return [];
    }

    if (startX === endX) {
      return [{
        x: startX, y: startY, w: 1, h: 1 + endY - startY, status, expected
      }];
    }

    const shapes = [];
    shapes.push({
      x: startX, y: startY, w: 1, h: 9 - startY, status, expected
    });
    shapes.push({
      x: endX, y: 0, w: 1, h: endY + 1, status, expected
    });

    if (startX < endX - 1) {
      shapes.push({
        x: startX + 1, y: 0, w: endX - startX - 1, h: 9, status, expected
      });
    }

    return shapes;
  }

  setMode(mode: 'difficulty' | 'halving'): boolean {
    this.mode = mode;
    this.userSelectedMode = true;
    return false;
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(event): void {
    if (this.epochSvgElement?.nativeElement?.contains(event.target)) {
      this.onPointerMove(event);
      event.preventDefault();
    }
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event): void {
    if (this.epochSvgElement?.nativeElement?.contains(event.target)) {
      this.tooltipPosition = { x: event.clientX, y: event.clientY };
      this.cd.markForCheck();
    }
  }

  onHover(_, rect): void {
    this.hoverSection = rect;
  }

  onBlur(): void {
    this.hoverSection = null;
  }
}

function getNextBlockSubsidy(height: number): number {
  const halvings = Math.floor(height / 210_000) + 1;
  // Force block reward to zero when right shift is undefined.
  if (halvings >= 64) {
    return 0;
  }

  let subsidy = BigInt(50 * 100_000_000);
  // Subsidy is cut in half every 210,000 blocks which will occur approximately every 4 years.
  subsidy >>= BigInt(halvings);
  return Number(subsidy);
}
