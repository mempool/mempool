import { Component, Input, OnChanges, SimpleChanges, ChangeDetectionStrategy, ElementRef, ViewChild, ChangeDetectorRef, HostListener, AfterViewInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CpfpClusterTx, CpfpClusterChunk } from '@app/interfaces/node-api.interface';
import { ThemeService } from '@app/services/theme.service';
import { StateService } from '@app/services/state.service';
import { feeLevels } from '@app/app.constants';
import { computeGridLayout, GridLayout } from './cluster-layout';
import { renderLayout, RenderedNode, RenderedEdge, RenderedChunkOutline } from './cluster-renderer';

const RESIZE_DEBOUNCE_MS = 100;

let nextClusterDiagramInstance = 0;

@Component({
  selector: 'app-cluster-diagram',
  templateUrl: './cluster-diagram.component.html',
  styleUrls: ['./cluster-diagram.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClusterDiagramComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() cluster: { txs: CpfpClusterTx[]; chunks: CpfpClusterChunk[]; chunkIndex: number };
  @Input() txid: string;
  @Input() preview = false;

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
  svgViewBox: string | null = null;
  activeChunkIndex = 0;

  hoverNode: RenderedNode | null = null;
  hoverEdge: RenderedEdge | null = null;
  hoverChunkIndex: number | null = null;
  tooltipPosition = { x: 0, y: 0 };

  readonly idPrefix = `cluster-${++nextClusterDiagramInstance}`;

  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastObservedWidth = 0;

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private stateService: StateService,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.cluster?.txs?.length) { return; }
    const clusterChanged = changes['cluster'] || changes['preview'];
    if (clusterChanged) {
      this.computeLayout();
    }
    this.renderLayout();
  }

  private computeLayout(): void {
    if (this.preview && this.cluster.chunks.length > 0) {
      const activeChunk = this.cluster.chunks[this.cluster.chunkIndex];
      const memberSet = new Set(activeChunk.txs);
      const remap = new Map<number, number>();
      activeChunk.txs.forEach((origIdx, newIdx) => remap.set(origIdx, newIdx));

      this.txs = activeChunk.txs.map(origIdx => ({
        ...this.cluster.txs[origIdx],
        parents: this.cluster.txs[origIdx].parents
          .filter(p => memberSet.has(p))
          .map(p => remap.get(p) as number),
      }));
      this.chunks = [{
        txs: this.txs.map((_, i) => i),
        feerate: activeChunk.feerate,
      }];
      this.activeChunkIndex = 0;
    } else {
      this.txs = this.cluster.txs;
      this.chunks = this.cluster.chunks;
      this.activeChunkIndex = this.cluster.chunkIndex;
    }
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
      preview: this.preview,
      idPrefix: this.idPrefix,
    });

    this.nodes = result.nodes;
    this.edges = result.edges;
    this.chunkOutlines = result.chunkOutlines;
    this.svgWidth = result.svgWidth;
    this.svgHeight = result.svgHeight;
    this.svgViewBox = result.viewBox;
  }

  onNodeEnter(node: RenderedNode, event: MouseEvent): void {
    if (this.preview) { return; }
    this.hoverNode = node;
    this.clearHighlights();
    node.hovered = true;
    for (const edge of this.edges) {
      if (edge.parentIndex === node.index) {
        this.nodes[edge.childIndex].relation = 'descendant';
        edge.highlighted = true;
        edge.highlightKind = 'descendant';
      } else if (edge.childIndex === node.index) {
        this.nodes[edge.parentIndex].relation = 'ancestor';
        edge.highlighted = true;
        edge.highlightKind = 'ancestor';
      }
    }
    this.updateTooltipPosition(event);
    this.cd.markForCheck();
  }

  onNodeMove(event: MouseEvent): void {
    if (this.preview) { return; }
    this.updateTooltipPosition(event);
    this.cd.markForCheck();
  }

  onNodeLeave(): void {
    if (this.preview) { return; }
    this.hoverNode = null;
    this.clearHighlights();
    this.cd.markForCheck();
  }

  onEdgeEnter(edgeIndex: number, event: MouseEvent): void {
    if (this.preview) { return; }
    this.clearHighlights();
    const edge = this.edges[edgeIndex];
    edge.highlighted = true;
    edge.highlightKind = 'direct';
    this.nodes[edge.parentIndex].relation = 'ancestor';
    this.nodes[edge.childIndex].relation = 'descendant';
    this.hoverEdge = edge;
    this.updateTooltipPosition(event);
    this.cd.markForCheck();
  }

  onEdgeMove(event: MouseEvent): void {
    if (this.preview) { return; }
    this.updateTooltipPosition(event);
    this.cd.markForCheck();
  }

  onEdgeLeave(): void {
    if (this.preview) { return; }
    this.hoverEdge = null;
    this.clearHighlights();
    this.cd.markForCheck();
  }

  onChunkEnter(chunkIndex: number): void {
    if (this.preview) { return; }
    this.hoverChunkIndex = chunkIndex;
    this.applyEffectiveChunk();
    this.cd.markForCheck();
  }

  onChunkLeave(): void {
    if (this.preview) { return; }
    this.hoverChunkIndex = null;
    this.applyEffectiveChunk();
    this.cd.markForCheck();
  }

  get effectiveActiveChunk(): number {
    return this.hoverChunkIndex ?? this.activeChunkIndex;
  }

  private applyEffectiveChunk(): void {
    const effective = this.effectiveActiveChunk;
    for (const node of this.nodes) {
      node.inactive = node.chunkIndex !== effective;
    }
    for (const edge of this.edges) {
      edge.parentInactive = this.nodes[edge.parentIndex].chunkIndex !== effective;
      edge.childInactive = this.nodes[edge.childIndex].chunkIndex !== effective;
    }
  }

  onNodeClick(node: RenderedNode): void {
    if (this.preview) { return; }
    const network = this.stateService.network;
    const prefix = network && network !== 'mainnet' ? `/${network}` : '';
    this.router.navigate([prefix + '/tx/', node.tx.txid]);
  }

  private clearHighlights(): void {
    for (const node of this.nodes) {
      node.hovered = false;
      node.relation = null;
    }
    for (const edge of this.edges) {
      edge.highlighted = false;
      edge.highlightKind = null;
    }
  }

  private updateTooltipPosition(event: MouseEvent): void {
    if (!this.graphContainer) { return; }
    if (!this.hoverNode && !this.hoverEdge) { return; }
    const container = this.graphContainer.nativeElement;
    const rect = container.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pad = 0;
    const visibleW = rect.width;
    let tipW = Math.min(360, visibleW);
    if (this.tooltipElement) {
      const measuredW = this.tooltipElement.nativeElement.getBoundingClientRect().width;
      if (measuredW > 0) {
        tipW = Math.min(measuredW, visibleW);
      }
    }

    const onLeftHalf = pointerX < visibleW / 2;
    const x = onLeftHalf ? visibleW - tipW - pad : pad;
    const y = pad;

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
    this.scheduleRerender();
  }

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined' && this.graphContainer?.nativeElement) {
      this.resizeObserver = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width ?? 0;
        if (Math.abs(width - this.lastObservedWidth) < 1) { return; }
        this.lastObservedWidth = width;
        this.scheduleRerender();
      });
      this.resizeObserver.observe(this.graphContainer.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.resizeTimer !== null) {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
  }

  private scheduleRerender(): void {
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
