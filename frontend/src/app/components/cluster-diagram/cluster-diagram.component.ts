import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy, ElementRef, ViewChild, ChangeDetectorRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CpfpClusterTx, CpfpClusterChunk } from '@app/interfaces/node-api.interface';
import { ThemeService } from '@app/services/theme.service';
import { StateService } from '@app/services/state.service';
import { feeLevels } from '@app/app.constants';
import { computeGridLayout, GridLayout } from './cluster-layout';
import { renderLayout, RenderedNode, RenderedEdge, RenderedChunkOutline, NODE_W, NODE_H } from './cluster-renderer';

const NODE_RX = 6;
const RESIZE_DEBOUNCE_MS = 100;

@Component({
  selector: 'app-cluster-diagram',
  templateUrl: './cluster-diagram.component.html',
  styleUrls: ['./cluster-diagram.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClusterDiagramComponent implements OnChanges {
  @Input() cluster: { txs: CpfpClusterTx[]; chunks: CpfpClusterChunk[]; chunkIndex: number };
  @Input() txid: string;

  @ViewChild('graphContainer', { static: true }) graphContainer: ElementRef;
  @ViewChild('tooltip') tooltipElement: ElementRef;

  txs: CpfpClusterTx[] = [];
  chunks: CpfpClusterChunk[] = [];
  gridLayout: GridLayout | null = null;
  nodes: RenderedNode[] = [];
  edges: RenderedEdge[] = [];
  chunkOutlines: RenderedChunkOutline[] = [];
  svgWidth = 0;
  svgHeight = 0;
  activeChunkIndex = 0;

  hoverNode: RenderedNode | null = null;
  tooltipPosition = { x: 0, y: 0 };

  readonly nodeW = NODE_W;
  readonly nodeH = NODE_H;
  readonly nodeRx = NODE_RX;

  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private stateService: StateService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.cluster?.txs?.length) { return; }
    this.activeChunkIndex = this.cluster.chunkIndex;
    const clusterChanged = changes['cluster'];
    if (clusterChanged) {
      this.computeLayout();
    }
    this.renderLayout();
  }

  private computeLayout(): void {
    this.txs = this.cluster.txs;
    this.chunks = this.cluster.chunks;
    this.gridLayout = computeGridLayout(this.txs, this.chunks);
  }

  private renderLayout(): void {
    if (!this.gridLayout) {
      return;
    }
    const containerWidth = this.graphContainer?.nativeElement?.clientWidth || 600;
    const colors = this.themeService.mempoolFeeColors;
    const getColor = (feerate: number): string => {
      let index = feeLevels.findIndex((level: number) => feerate < level);
      if (index < 0) { index = feeLevels.length; }
      index = Math.min(index, colors.length - 1);
      return '#' + colors[index];
    };

    const result = renderLayout(this.gridLayout, {
      containerWidth,
      activeChunkIndex: this.activeChunkIndex,
      currentTxid: this.txid,
      txFees: this.txs.map(tx => tx.fee),
      txWeights: this.txs.map(tx => tx.weight),
      txids: this.txs.map(tx => tx.txid),
      chunkFeerates: this.chunks.map(c => c.feerate),
      getColor,
    });

    this.nodes = result.nodes;
    this.edges = result.edges;
    this.chunkOutlines = result.chunkOutlines;
    this.svgWidth = result.svgWidth;
    this.svgHeight = result.svgHeight;
  }

  onNodeEnter(node: RenderedNode, event: MouseEvent): void {
    this.hoverNode = node;
    this.clearHighlights();
    node.hovered = true;
    for (const edge of this.edges) {
      if (edge.parentIndex === node.index) {
        this.nodes[edge.childIndex].related = true;
        edge.highlighted = true;
      } else if (edge.childIndex === node.index) {
        this.nodes[edge.parentIndex].related = true;
        edge.highlighted = true;
      }
    }
    this.updateTooltipPosition(event);
    this.cd.markForCheck();
  }

  onNodeMove(event: MouseEvent): void {
    this.updateTooltipPosition(event);
    this.cd.markForCheck();
  }

  onNodeLeave(): void {
    this.hoverNode = null;
    this.clearHighlights();
    this.cd.markForCheck();
  }

  onEdgeEnter(edgeIndex: number): void {
    this.clearHighlights();
    const edge = this.edges[edgeIndex];
    edge.highlighted = true;
    this.nodes[edge.parentIndex].related = true;
    this.nodes[edge.childIndex].related = true;
    this.cd.markForCheck();
  }

  onEdgeLeave(): void {
    this.clearHighlights();
    this.cd.markForCheck();
  }

  onNodeClick(node: RenderedNode): void {
    const network = this.stateService.network;
    const prefix = network && network !== 'mainnet' ? `/${network}` : '';
    this.router.navigate([prefix + '/tx/', node.tx.txid]);
  }

  private clearHighlights(): void {
    for (const node of this.nodes) {
      node.hovered = false;
      node.related = false;
    }
    for (const edge of this.edges) {
      edge.highlighted = false;
    }
  }

  private updateTooltipPosition(event: MouseEvent): void {
    if (!this.graphContainer) { return; }
    const container = this.graphContainer.nativeElement;
    const rect = container.getBoundingClientRect();
    let x = event.clientX - rect.left + container.scrollLeft + 15;
    let y = event.clientY - rect.top + container.scrollTop + 15;

    if (this.tooltipElement) {
      const tipRect = this.tooltipElement.nativeElement.getBoundingClientRect();
      const visibleLeft = container.scrollLeft;
      const visibleRight = visibleLeft + rect.width;
      const visibleTop = container.scrollTop;
      const visibleBottom = visibleTop + rect.height;

      if (x + tipRect.width > visibleRight) {
        x = Math.max(visibleLeft, visibleRight - tipRect.width - 10);
      }
      if (x < visibleLeft) {
        x = visibleLeft;
      }
      if (y + tipRect.height > visibleBottom) {
        y = y - tipRect.height - 30;
      }
      if (y < visibleTop) {
        y = visibleTop;
      }
    }

    this.tooltipPosition = { x, y };
  }

  trackByNodeIndex(_index: number, node: RenderedNode): number {
    return node.index;
  }

  trackByEdgeId(_index: number, edge: RenderedEdge): string {
    return edge.gradientId;
  }

  trackByChunkIndex(_index: number, outline: RenderedChunkOutline): number {
    return outline.chunkIndex;
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer);
    }
    this.resizeTimer = setTimeout(() => {
      this.resizeTimer = null;
      this.renderLayout();
      this.cd.markForCheck();
    }, RESIZE_DEBOUNCE_MS);
  }
}
