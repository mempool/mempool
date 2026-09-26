import { ChangeDetectionStrategy, Component, ElementRef, HostListener, Input, OnChanges, ViewChild } from '@angular/core';
import { AverageCoinSplit, averageCoinSplit } from '@app/shared/address-utils';
import { isMobile } from '@app/shared/common.utils';
import { FEE_WEDGE_OPACITY, FEE_WEDGE_OPACITY_UNECONOMICAL } from '@components/utxo-graph/utxo-graph.component';

type HoverTarget = 'kept' | 'fee';

@Component({
  selector: 'app-average-coin',
  templateUrl: './average-coin.component.html',
  styleUrls: ['./average-coin.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AverageCoinComponent implements OnChanges {
  @Input() balance: number;
  @Input() utxoCount: number;
  @Input() vsizePerInput: number;
  @Input() feerate: number;
  @Input() feeImpact: boolean = true;

  readonly r = 100;
  readonly cx = this.r + 10;
  readonly cy = this.r + 10;
  readonly viewBox = `0 0 ${this.cx * 2} ${this.cy * 2}`;
  readonly wedgeOpacity = FEE_WEDGE_OPACITY;
  readonly discOpacity = FEE_WEDGE_OPACITY_UNECONOMICAL;
  // keep a tiny-but-real fee visible as a sliver (~2°), not "no fee at all"
  readonly minWedgeFrac = 0.005;
  // near a full sweep the rounded arc endpoint lands on its start point and SVG drops the
  // arc entirely; cap just below 1 (takenFrac === 1 renders as the full disc instead)
  readonly maxWedgeFrac = 0.9995;
  // below this share the percentage rounds to nothing, so label it "≈0%" instead of "0.0%"
  readonly tinyShare = 0.001;

  split: AverageCoinSplit | null = null;
  wedgePath: string | null = null;

  // hover detail tooltip — a bonus over the always-visible stats; not needed to read the figure
  hoverTarget: HoverTarget | null = null;
  tooltipPosition = { x: 0, y: 0 };
  isMobile: boolean;

  @ViewChild('tooltip') tooltipElement: ElementRef<HTMLElement>;

  constructor() {
    this.onResize();
  }

  ngOnChanges(): void {
    // pure derivation from inputs; null when aggregates are unusable or the feerate is not yet seeded
    this.split = averageCoinSplit(this.balance, this.utxoCount, this.vsizePerInput, this.feerate);
    this.wedgePath = this.buildWedgePath();
  }

  // pie sector from 12 o'clock, sweeping clockwise — the same fee-wedge grammar as the
  // per-UTXO bubble chart, so both regimes read identically
  private buildWedgePath(): string | null {
    const s = this.split;
    if (!s || s.feePerInput <= 0) {
      return null;
    }
    if (s.takenFrac >= 1) {
      return null; // full disc is drawn as a plain circle instead of a degenerate arc
    }
    const frac = Math.min(Math.max(s.takenFrac, this.minWedgeFrac), this.maxWedgeFrac);
    const angle = frac * 2 * Math.PI;
    const x = +(this.cx + this.r * Math.sin(angle)).toFixed(2);
    const y = +(this.cy - this.r * Math.cos(angle)).toFixed(2);
    const largeArc = frac > 0.5 ? 1 : 0;
    return `M ${this.cx} ${this.cy} L ${this.cx} ${this.cy - this.r} A ${this.r} ${this.r} 0 ${largeArc} 1 ${x} ${y} Z`;
  }

  // template-bound pointer events trigger change detection on their own, so OnPush needs no markForCheck here
  showTooltip(target: HoverTarget, event: PointerEvent): void {
    if (!this.feeImpact) {
      return; // with fee impact off the shares/amounts the tooltip explains are not on display
    }
    this.hoverTarget = target;
    this.moveTooltip(event);
  }

  moveTooltip(event: PointerEvent): void {
    if (this.isMobile) {
      return; // mobile has no cursor; the tooltip is pinned via CSS instead
    }
    let x = event.clientX;
    const y = event.clientY - 12;
    if (this.tooltipElement) {
      const bounds = this.tooltipElement.nativeElement.getBoundingClientRect();
      x -= bounds.width / 2;
      x = Math.min(Math.max(x, 20), window.innerWidth - 20 - bounds.width);
    }
    this.tooltipPosition = { x, y };
  }

  hideTooltip(): void {
    this.hoverTarget = null;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = isMobile();
  }
}
