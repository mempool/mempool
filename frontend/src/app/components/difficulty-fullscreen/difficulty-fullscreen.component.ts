import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Inject, LOCALE_ID, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { BlockStatus, EPOCH_BLOCK_LENGTH, EpochProgress, getEpochProgress, getEpochState } from '@app/shared/difficulty.utils';

@Component({
  selector: 'app-difficulty-fullscreen',
  templateUrl: './difficulty-fullscreen.component.html',
  styleUrls: ['./difficulty-fullscreen.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DifficultyFullscreenComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('epochCanvas') canvas: ElementRef<HTMLCanvasElement>;

  readonly epochBlockLength = EPOCH_BLOCK_LENGTH;

  isLoadingWebSocket$: Observable<boolean>;
  difficultyEpoch$: Observable<EpochProgress>;
  epochSubscription: Subscription;

  now: number = Date.now();
  epochStart: number;
  currentHeight: number;
  currentIndex: number;
  expectedHeight: number;
  expectedIndex: number;
  difference: number;

  // canvas layout
  columns: number = 48;
  rows: number = 42;
  cellSize: number = 32;
  gap: number = 2;
  dpr: number = 1;

  // theme colors resolved from CSS variables
  private colors = {
    primary: '#105fb0',
    mainnetAlt: '#9339f4',
    red: '#dc3545',
    green: '#3bcc49',
    background: '#11131f',
  };

  private animationFrame: number;
  private pulse: number = 0;
  private hasNextBlock: boolean = false;

  constructor(
    public stateService: StateService,
    private websocketService: WebsocketService,
    private cd: ChangeDetectorRef,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'stats']);

    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.difficultyEpoch$ = combineLatest([
      this.stateService.blocks$,
      this.stateService.difficultyAdjustment$,
    ])
    .pipe(
      map(([, da]) => {
        const epoch = getEpochState(this.stateService.latestBlockHeight, da);
        this.now = new Date().getTime();

        if (epoch.epochStart !== this.epochStart || epoch.expectedHeight !== this.expectedHeight || epoch.currentHeight !== this.currentHeight) {
          this.epochStart = epoch.epochStart;
          this.expectedHeight = epoch.expectedHeight;
          this.currentHeight = epoch.currentHeight;
          this.currentIndex = epoch.currentIndex;
          this.expectedIndex = epoch.expectedIndex;
          this.difference = epoch.difference;
          this.hasNextBlock = this.currentIndex + 1 < EPOCH_BLOCK_LENGTH;
        }

        const data: EpochProgress = {
          ...getEpochProgress(da, this.locale),
          minedBlocks: this.currentIndex + 1,
        };
        return data;
      })
    );

    if (this.stateService.isBrowser) {
      // Redraw whenever the epoch data changes.
      this.epochSubscription = this.difficultyEpoch$.subscribe(() => {
        this.resizeCanvas();
      });
    }
  }

  ngAfterViewInit(): void {
    // The canvas lives behind an *ngIf and is only available after the view is
    // initialized, so do the first draw and start the animation here.
    if (this.stateService.isBrowser) {
      this.resizeCanvas();
      this.startAnimation();
    }
  }

  ngOnDestroy(): void {
    if (this.epochSubscription) {
      this.epochSubscription.unsubscribe();
    }
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }

  statusForIndex(i: number): BlockStatus {
    if (i <= this.currentIndex) {
      return i > this.expectedIndex ? 'ahead' : 'mined';
    }
    if (i === this.currentIndex + 1) {
      return 'next';
    }
    return i <= this.expectedIndex ? 'behind' : 'remaining';
  }

  startAnimation(): void {
    // Redraw at ~30fps rather than every frame: drawing all 2016 cells each
    // frame is wasteful, and the pulse animation reads fine at this rate.
    const minFrameInterval = 1000 / 30;
    let lastDraw = 0;
    const loop = (now: number): void => {
      this.animationFrame = requestAnimationFrame(loop);
      // Nothing animates once the epoch is full (no "next" block to pulse),
      // so skip the per-frame redraws entirely.
      if (!this.hasNextBlock) {
        return;
      }
      if (now - lastDraw < minFrameInterval) {
        return;
      }
      lastDraw = now;
      this.pulse = (Math.sin(Date.now() / 1000 * Math.PI) + 1) / 2; // 0..1, ~2s period
      this.draw();
    };
    this.animationFrame = requestAnimationFrame(loop);
  }

  @HostListener('window:resize', ['$event'])
  resizeCanvas(): void {
    if (!this.stateService.isBrowser) {
      return;
    }
    const canvasEl = this.canvas?.nativeElement;
    if (!canvasEl) {
      return;
    }

    this.resolveColors();

    const parent = canvasEl.parentElement;
    const width = parent ? parent.clientWidth : (window.innerWidth || 800);
    const height = parent ? parent.clientHeight : (window.innerHeight || 800);

    // Choose a column count so that 2016 cells roughly fill the available area.
    const targetAspect = width / Math.max(1, height);
    const columns = Math.max(12, Math.min(EPOCH_BLOCK_LENGTH, Math.round(Math.sqrt(EPOCH_BLOCK_LENGTH * targetAspect))));
    const rows = Math.ceil(EPOCH_BLOCK_LENGTH / columns);
    const gap = 2;
    const sizeByWidth = Math.floor((width - (columns + 1) * gap) / columns);
    const sizeByHeight = Math.floor((height - (rows + 1) * gap) / rows);

    this.columns = columns;
    this.rows = rows;
    this.gap = gap;
    this.cellSize = Math.max(2, Math.min(sizeByWidth, sizeByHeight));
    this.dpr = window.devicePixelRatio || 1;

    canvasEl.width = Math.floor(width * this.dpr);
    canvasEl.height = Math.floor(height * this.dpr);
    canvasEl.style.width = `${width}px`;
    canvasEl.style.height = `${height}px`;

    this.draw();
  }

  private resolveColors(): void {
    const root = this.canvas?.nativeElement;
    if (!root) {
      return;
    }
    const style = getComputedStyle(root);
    const read = (name: string, fallback: string): string => {
      const v = style.getPropertyValue(name).trim();
      return v || fallback;
    };
    this.colors = {
      primary: read('--primary', this.colors.primary),
      mainnetAlt: read('--mainnet-alt', this.colors.mainnetAlt),
      red: read('--red', this.colors.red),
      green: read('--success', this.colors.green),
      background: read('--active-bg', this.colors.background) || this.colors.background,
    };
  }

  draw(): void {
    const canvasEl = this.canvas?.nativeElement;
    if (!canvasEl || this.currentIndex === undefined || this.currentIndex === null) {
      return;
    }
    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      return;
    }

    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const widthCss = canvasEl.width / dpr;
    const heightCss = canvasEl.height / dpr;
    ctx.clearRect(0, 0, widthCss, heightCss);

    const cell = this.cellSize;
    const gap = this.gap;
    const gridWidth = this.columns * cell + (this.columns - 1) * gap;
    const gridHeight = this.rows * cell + (this.rows - 1) * gap;
    const offsetX = Math.max(0, (widthCss - gridWidth) / 2);
    const offsetY = Math.max(0, (heightCss - gridHeight) / 2);

    for (let i = 0; i < EPOCH_BLOCK_LENGTH; i++) {
      const col = i % this.columns;
      const row = Math.floor(i / this.columns);
      const x = offsetX + col * (cell + gap);
      const y = offsetY + row * (cell + gap);
      this.drawBlock(ctx, x, y, cell, this.statusForIndex(i));
    }
  }

  private drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, status: BlockStatus): void {
    let frontTop: string;
    let frontBottom: string;
    let topFace: string;
    let rightFace: string;

    switch (status) {
      case 'mined':
        frontTop = this.colors.primary;
        frontBottom = this.colors.mainnetAlt;
        topFace = this.shade(this.colors.primary, 0.25);
        rightFace = this.shade(this.colors.mainnetAlt, -0.25);
        break;
      case 'ahead':
        // mined faster than expected — green like the mempool blocks
        frontTop = this.shade(this.colors.green, 0.1);
        frontBottom = this.shade(this.colors.green, -0.12);
        topFace = this.shade(this.colors.green, 0.25);
        rightFace = this.shade(this.colors.green, -0.3);
        break;
      case 'behind':
        // expected by now but not yet mined — red
        frontTop = this.shade(this.colors.red, 0.1);
        frontBottom = this.shade(this.colors.red, -0.12);
        topFace = this.shade(this.colors.red, 0.25);
        rightFace = this.shade(this.colors.red, -0.3);
        break;
      case 'next': {
        // pulsing white highlight (matches the old difficulty component)
        const p = this.pulse;
        frontTop = this.mix('#2d3348', '#ffffff', p);
        frontBottom = this.mix('#20253a', '#ffffff', p);
        topFace = this.mix('#3a4258', '#ffffff', p);
        rightFace = this.mix('#191d2c', '#ffffff', p);
        break;
      }
      case 'remaining':
      default:
        frontTop = '#1b1e2e';
        frontBottom = '#15182b';
        topFace = '#232838';
        rightFace = '#101220';
        break;
    }

    // Small isometric bevel proportional to the cell size.
    const depth = Math.max(1, Math.round(size * 0.18));
    const fx = x;
    const fy = y + depth;
    const fw = size - depth;
    const fh = size - depth;

    // Top face (parallelogram)
    ctx.fillStyle = topFace;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + depth, y);
    ctx.lineTo(fx + depth + fw, y);
    ctx.lineTo(fx + fw, fy);
    ctx.closePath();
    ctx.fill();

    // Right face (parallelogram)
    ctx.fillStyle = rightFace;
    ctx.beginPath();
    ctx.moveTo(fx + fw, fy);
    ctx.lineTo(fx + fw + depth, y);
    ctx.lineTo(fx + fw + depth, y + fh);
    ctx.lineTo(fx + fw, fy + fh);
    ctx.closePath();
    ctx.fill();

    // Front face (gradient, like the blockchain blocks)
    if (fw > 3 && fh > 3) {
      const grad = ctx.createLinearGradient(fx, fy, fx, fy + fh);
      grad.addColorStop(0, frontTop);
      grad.addColorStop(1, frontBottom);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = frontBottom;
    }
    ctx.fillRect(fx, fy, fw, fh);
  }

  // Lighten (amount > 0) or darken (amount < 0) a hex color.
  private shade(hex: string, amount: number): string {
    const c = this.parseColor(hex);
    if (!c) {
      return hex;
    }
    const adj = (v: number): number => Math.max(0, Math.min(255, Math.round(v + amount * 255)));
    return `rgb(${adj(c.r)}, ${adj(c.g)}, ${adj(c.b)})`;
  }

  // Linear blend between two colors. t = 0 -> a, t = 1 -> b.
  private mix(a: string, b: string, t: number): string {
    const ca = this.parseColor(a);
    const cb = this.parseColor(b);
    if (!ca || !cb) {
      return a;
    }
    const m = (x: number, y: number): number => Math.round(x + (y - x) * t);
    return `rgb(${m(ca.r, cb.r)}, ${m(ca.g, cb.g)}, ${m(ca.b, cb.b)})`;
  }

  private parseColor(input: string): { r: number; g: number; b: number } | null {
    if (!input) {
      return null;
    }
    const str = input.trim();
    if (str.startsWith('#')) {
      let hex = str.slice(1);
      if (hex.length === 3) {
        hex = hex.split('').map(ch => ch + ch).join('');
      }
      if (hex.length >= 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
        };
      }
      return null;
    }
    const match = str.match(/rgba?\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(',').map(p => parseFloat(p));
      if (parts.length >= 3) {
        return { r: parts[0], g: parts[1], b: parts[2] };
      }
    }
    return null;
  }
}
