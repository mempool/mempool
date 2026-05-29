import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, ElementRef, ViewChild, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { BlockStatus, EpochProgress, getEpochProgress, getEpochState, getNextBlockSubsidy } from '@app/shared/difficulty.utils';

interface DiffShape {
  x: number;
  y: number;
  w: number;
  h: number;
  status: BlockStatus;
  expected: boolean;
}

@Component({
  selector: 'app-difficulty',
  templateUrl: './difficulty.component.html',
  styleUrls: ['./difficulty.component.scss'],
  standalone: false,
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

        const blocksUntilHalving = 210000 - (maxHeight % 210000);
        const timeUntilHalving = new Date().getTime() + (blocksUntilHalving * 600000);
        const epoch = getEpochState(this.stateService.latestBlockHeight, da);
        this.now = new Date().getTime();
        this.nextSubsidy = getNextBlockSubsidy(maxHeight);

        if (blocksUntilHalving < da.remainingBlocks && !this.userSelectedMode) {
          this.mode = 'halving';
        }

        if (epoch.epochStart !== this.epochStart || epoch.expectedHeight !== this.expectedHeight || epoch.currentHeight !== this.currentHeight) {
          this.epochStart = epoch.epochStart;
          this.expectedHeight = epoch.expectedHeight;
          this.currentHeight = epoch.currentHeight;
          this.currentIndex = epoch.currentIndex;
          this.expectedIndex = epoch.expectedIndex;
          this.difference = epoch.difference;

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


        const data: EpochProgress = {
          ...getEpochProgress(da, this.locale),
          minedBlocks: this.currentIndex,
          blocksUntilHalving,
          timeUntilHalving,
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
