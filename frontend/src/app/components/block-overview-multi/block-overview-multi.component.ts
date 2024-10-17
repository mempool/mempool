import { Component, ElementRef, ViewChild, HostListener, Input, Output, EventEmitter, NgZone, AfterViewInit, OnDestroy, OnChanges } from '@angular/core';
import { TransactionStripped } from '../../interfaces/node-api.interface';
import { FastVertexArray } from '../block-overview-graph/fast-vertex-array';
import BlockScene from '../block-overview-graph/block-scene';
import TxSprite from '../block-overview-graph/tx-sprite';
import TxView from '../block-overview-graph/tx-view';
import { Color, Position } from '../block-overview-graph/sprite-types';
import { Price } from '../../services/price.service';
import { StateService } from '../../services/state.service';
import { ThemeService } from '../../services/theme.service';
import { Subscription } from 'rxjs';
import { defaultColorFunction, setOpacity, defaultAuditColors, defaultColors, ageColorFunction, contrastColorFunction, contrastAuditColors, contrastColors } from '../block-overview-graph/utils';
import { ActiveFilter, FilterMode, toFlags } from '../../shared/filters.utils';
import { detectWebGL } from '../../shared/graphs.utils';

const unmatchedOpacity = 0.2;
const unmatchedAuditColors = {
  censored: setOpacity(defaultAuditColors.censored, unmatchedOpacity),
  missing: setOpacity(defaultAuditColors.missing, unmatchedOpacity),
  added: setOpacity(defaultAuditColors.added, unmatchedOpacity),
  added_prioritized: setOpacity(defaultAuditColors.added_prioritized, unmatchedOpacity),
  prioritized: setOpacity(defaultAuditColors.prioritized, unmatchedOpacity),
  accelerated: setOpacity(defaultAuditColors.accelerated, unmatchedOpacity),
};
const unmatchedContrastAuditColors = {
  censored: setOpacity(contrastAuditColors.censored, unmatchedOpacity),
  missing: setOpacity(contrastAuditColors.missing, unmatchedOpacity),
  added: setOpacity(contrastAuditColors.added, unmatchedOpacity),
  added_prioritized: setOpacity(contrastAuditColors.added_prioritized, unmatchedOpacity),
  prioritized: setOpacity(contrastAuditColors.prioritized, unmatchedOpacity),
  accelerated: setOpacity(contrastAuditColors.accelerated, unmatchedOpacity),
};

@Component({
  selector: 'app-block-overview-multi',
  templateUrl: './block-overview-multi.component.html',
  styleUrls: ['./block-overview-multi.component.scss'],
})
export class BlockOverviewMultiComponent implements AfterViewInit, OnDestroy, OnChanges {
  @Input() isLoading: boolean;
  @Input() resolution: number;
  @Input() numBlocks: number;
  @Input() padding: number = 0;
  @Input() blockWidth: number = 360;
  @Input() autofit: boolean = false;
  @Input() blockLimit: number;
  @Input() orientation = 'left';
  @Input() flip = true;
  @Input() animationDuration: number = 1000;
  @Input() animationOffset: number | null = null;
  @Input() disableSpinner = false;
  @Input() mirrorTxid: string | void;
  @Input() unavailable: boolean = false;
  @Input() auditHighlighting: boolean = false;
  @Input() showFilters: boolean = false;
  @Input() excludeFilters: string[] = [];
  @Input() filterFlags: bigint | null = null;
  @Input() filterMode: FilterMode = 'and';
  @Input() gradientMode: 'fee' | 'age' = 'fee';
  @Input() relativeTime: number | null;
  @Input() blockConversion: Price;
  @Input() overrideColors: ((tx: TxView) => Color) | null = null;
  @Output() txClickEvent = new EventEmitter<{ tx: TransactionStripped, keyModifier: boolean}>();
  @Output() txHoverEvent = new EventEmitter<string>();
  @Output() readyEvent = new EventEmitter();

  @ViewChild('blockCanvas')
  canvas: ElementRef<HTMLCanvasElement>;
  themeChangedSubscription: Subscription;

  gl: WebGLRenderingContext;
  animationFrameRequest: number;
  animationHeartBeat: number;
  displayWidth: number;
  displayHeight: number;
  displayBlockWidth: number;
  displayPadding: number;
  cssWidth: number;
  cssHeight: number;
  shaderProgram: WebGLProgram;
  vertexArray: FastVertexArray;
  running: boolean;
  scenes: BlockScene[] = [];
  hoverTx: TxView | void;
  selectedTx: TxView | void;
  highlightTx: TxView | void;
  mirrorTx: TxView | void;
  tooltipPosition: Position;

  readyNextFrame = false;
  lastUpdate: number = 0;
  pendingUpdates: {
    count: number,
    add: { [txid: string]: TransactionStripped },
    remove: { [txid: string]: string },
    change: { [txid: string]: { txid: string, rate: number | undefined, acc: boolean | undefined } },
    direction?: string,
  }[] = [];

  searchText: string;
  searchSubscription: Subscription;
  filtersAvailable: boolean = true;
  activeFilterFlags: bigint | null = null;

  webGlEnabled = true;

  constructor(
    readonly ngZone: NgZone,
    readonly elRef: ElementRef,
    public stateService: StateService,
    private themeService: ThemeService,
  ) {
    this.webGlEnabled = this.stateService.isBrowser && detectWebGL();
    this.vertexArray = new FastVertexArray(512, TxSprite.dataSize);
  }

  ngAfterViewInit(): void {
    if (this.canvas) {
      this.canvas.nativeElement.addEventListener('webglcontextlost', this.handleContextLost, false);
      this.canvas.nativeElement.addEventListener('webglcontextrestored', this.handleContextRestored, false);
      this.gl = this.canvas.nativeElement.getContext('webgl');
      this.initScenes();

      if (this.gl) {
        this.initCanvas();
        this.resizeCanvas();
        this.themeChangedSubscription = this.themeService.themeChanged$.subscribe(() => {
          for (const scene of this.scenes) {
            scene.setColorFunction(this.getColorFunction());
          }
        });
      }
    }
  }

  initScenes(): void {
    for (const scene of this.scenes) {
      if (scene) {
        scene.destroy();
      }
    }
    this.scenes = [];
    this.pendingUpdates = [];
    for (let i = 0; i < this.numBlocks; i++) {
      this.scenes.push(null);
      this.pendingUpdates.push({
        count: 0,
        add: {},
        remove: {},
        change: {},
        direction: 'left',
      });
    }
    this.resizeCanvas();
    this.start();
  }

  ngOnChanges(changes): void {
    if (changes.numBlocks) {
      this.initScenes();
    }
    if (changes.orientation || changes.flip) {
      for (const scene of this.scenes) {
        scene?.setOrientation(this.orientation, this.flip);
      }
    }
    if (changes.auditHighlighting) {
      this.setHighlightingEnabled(this.auditHighlighting);
    }
    if (changes.overrideColor) {
      for (const scene of this.scenes) {
        scene?.setColorFunction(this.getFilterColorFunction(0n, this.gradientMode));
      }
    }
    if ((changes.filterFlags || changes.showFilters || changes.filterMode || changes.gradientMode)) {
      this.setFilterFlags();
    }
  }

  setFilterFlags(goggle?: ActiveFilter): void {
    this.filterMode = goggle?.mode || this.filterMode;
    this.gradientMode = goggle?.gradient || this.gradientMode;
    this.activeFilterFlags = goggle?.filters ? toFlags(goggle.filters) : this.filterFlags;
    for (const scene of this.scenes) {
      if (this.activeFilterFlags != null && this.filtersAvailable) {
        scene.setColorFunction(this.getFilterColorFunction(this.activeFilterFlags, this.gradientMode));
      } else {
        scene.setColorFunction(this.getFilterColorFunction(0n, this.gradientMode));
      }
    }
    this.start();
  }

  ngOnDestroy(): void {
    if (this.animationFrameRequest) {
      cancelAnimationFrame(this.animationFrameRequest);
      clearTimeout(this.animationHeartBeat);
    }
    if (this.canvas) {
      this.canvas.nativeElement.removeEventListener('webglcontextlost', this.handleContextLost);
      this.canvas.nativeElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
      this.themeChangedSubscription?.unsubscribe();
    }
  }

  clear(block: number, direction): void {
    this.exit(block, direction);
    this.start();
  }

  destroy(block: number): void {
    if (this.scenes[block]) {
      this.scenes[block].destroy();
      this.clearUpdateQueue(block);
      this.start();
    }
  }

  // initialize the scene without any entry transition
  setup(block: number, transactions: TransactionStripped[], sort: boolean = false): void {
    const filtersAvailable = transactions.reduce((flagSet, tx) => flagSet || tx.flags > 0, false);
    if (filtersAvailable !== this.filtersAvailable) {
      this.setFilterFlags();
    }
    this.filtersAvailable = filtersAvailable;
    if (this.scenes[block]) {
      this.clearUpdateQueue(block);
      this.scenes[block].setup(transactions, sort);
      this.readyNextFrame = true;
      this.start();
    }
  }

  enter(block: number, transactions: TransactionStripped[], direction: string): void {
    if (this.scenes[block]) {
      this.clearUpdateQueue(block);
      this.scenes[block].enter(transactions, direction);
      this.start();
    }
  }

  exit(block: number, direction: string): void {
    if (this.scenes[block]) {
      this.clearUpdateQueue(block);
      this.scenes[block].exit(direction);
      this.start();
    }
  }

  replace(block: number, transactions: TransactionStripped[], direction: string, sort: boolean = true, startTime?: number): void {
    if (this.scenes[block]) {
      this.clearUpdateQueue(block);
      this.scenes[block].replace(transactions || [], direction, sort, startTime);
      this.start();
    }
  }

  // collates deferred updates into a set of consistent pending changes
  queueUpdate(block: number, add: TransactionStripped[], remove: string[], change: { txid: string, rate: number | undefined, acc: boolean | undefined }[], direction: string = 'left'): void {
    for (const tx of add) {
      this.pendingUpdates[block].add[tx.txid] = tx;
      delete this.pendingUpdates[block].remove[tx.txid];
      delete this.pendingUpdates[block].change[tx.txid];
    }
    for (const txid of remove) {
      delete this.pendingUpdates[block].add[txid];
      this.pendingUpdates[block].remove[txid] = txid;
      delete this.pendingUpdates[block].change[txid];
    }
    for (const tx of change) {
      if (this.pendingUpdates[block].add[tx.txid]) {
        this.pendingUpdates[block].add[tx.txid].rate = tx.rate;
        this.pendingUpdates[block].add[tx.txid].acc = tx.acc;
      } else {
        this.pendingUpdates[block].change[tx.txid] = tx;
      }
    }
    this.pendingUpdates[block].direction = direction;
    this.pendingUpdates[block].count++;
  }

  deferredUpdate(block: number, add: TransactionStripped[], remove: string[], change: { txid: string, rate: number | undefined, acc: boolean | undefined }[], direction: string = 'left'): void {
    this.queueUpdate(block, add, remove, change, direction);
    this.applyQueuedUpdates();
  }

  applyQueuedUpdates(): void {
    for (const [index, pendingUpdate] of this.pendingUpdates.entries()) {
      if (pendingUpdate.count && performance.now() > (this.lastUpdate + this.animationDuration)) {
        this.applyUpdate(index, Object.values(pendingUpdate.add), Object.values(pendingUpdate.remove), Object.values(pendingUpdate.change), pendingUpdate.direction);
        this.clearUpdateQueue(index);
      }
    }
  }

  clearUpdateQueue(block: number): void {
    this.pendingUpdates[block] = {
      count: 0,
      add: {},
      remove: {},
      change: {},
    };
    this.lastUpdate = performance.now();
  }

  update(block: number, add: TransactionStripped[], remove: string[], change: { txid: string, rate: number | undefined, acc: boolean | undefined }[], direction: string = 'left', resetLayout: boolean = false): void {
    // merge any pending changes into this update
    this.queueUpdate(block, add, remove, change, direction);
    this.applyUpdate(block,Object.values(this.pendingUpdates[block].add), Object.values(this.pendingUpdates[block].remove), Object.values(this.pendingUpdates[block].change), direction, resetLayout);
    this.clearUpdateQueue(block);
  }

  applyUpdate(block: number, add: TransactionStripped[], remove: string[], change: { txid: string, rate: number | undefined, acc: boolean | undefined }[], direction: string = 'left', resetLayout: boolean = false): void {
    if (this.scenes[block]) {
      add = add.filter(tx => !this.scenes[block].txs[tx.txid]);
      remove = remove.filter(txid => this.scenes[block].txs[txid]);
      change = change.filter(tx => this.scenes[block].txs[tx.txid]);

      if (this.gradientMode === 'age') {
        this.scenes[block].updateAllColors();
      }
      this.scenes[block].update(add, remove, change, direction, resetLayout);
      this.start();
      this.lastUpdate = performance.now();
    }
  }

  initCanvas(): void {
    if (!this.canvas || !this.gl) {
      return;
    }

    this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    const shaderSet = [
      {
        type: this.gl.VERTEX_SHADER,
        src: vertShaderSrc
      },
      {
        type: this.gl.FRAGMENT_SHADER,
        src: fragShaderSrc
      }
    ];

    this.shaderProgram = this.buildShaderProgram(shaderSet);

    this.gl.useProgram(this.shaderProgram);

    // Set up alpha blending
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

    const glBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, glBuffer);

    /* SET UP SHADER ATTRIBUTES */
    Object.keys(attribs).forEach((key, i) => {
      attribs[key].pointer = this.gl.getAttribLocation(this.shaderProgram, key);
      this.gl.enableVertexAttribArray(attribs[key].pointer);
    });

    this.start();
  }

  handleContextLost(event): void {
    event.preventDefault();
    cancelAnimationFrame(this.animationFrameRequest);
    this.animationFrameRequest = null;
    this.running = false;
    this.gl = null;
  }

  handleContextRestored(event): void {
    if (this.canvas?.nativeElement) {
      this.gl = this.canvas.nativeElement.getContext('webgl');
      if (this.gl) {
        this.initCanvas();
      }
    }
  }

  @HostListener('window:resize', ['$event'])
  resizeCanvas(): void {
    if (this.canvas) {
      this.cssWidth = this.canvas.nativeElement.offsetParent.clientWidth;
      this.cssHeight = this.canvas.nativeElement.offsetParent.clientHeight;
      this.displayWidth = window.devicePixelRatio * this.cssWidth;
      this.displayHeight = window.devicePixelRatio * this.cssHeight;
      this.displayBlockWidth = window.devicePixelRatio * this.blockWidth;
      this.displayPadding = window.devicePixelRatio * this.padding;
      this.canvas.nativeElement.width = this.displayWidth;
      this.canvas.nativeElement.height = this.displayHeight;
      if (this.gl) {
        this.gl.viewport(0, 0, this.displayWidth, this.displayHeight);
      }
      for (let i = 0; i < this.scenes.length; i++) {
        const blocksPerRow = Math.floor(this.displayWidth / (this.displayBlockWidth + (this.displayPadding * 2)));
        const x = this.displayPadding + ((i % blocksPerRow) * (this.displayBlockWidth + (this.displayPadding * 2)));
        const numRows = Math.ceil(this.scenes.length / blocksPerRow);
        const row = numRows - Math.floor(i / blocksPerRow) - 1;
        const y = this.displayPadding + this.displayHeight - ((row + 1) * (this.displayBlockWidth + (this.displayPadding * 2)));
        if (this.scenes[i]) {
          this.scenes[i].resize({ x, y, width: this.displayBlockWidth, height: this.displayBlockWidth, animate: false });
          this.start();
        } else {
          this.scenes[i] = new BlockScene({ x, y, width: this.displayBlockWidth, height: this.displayBlockWidth, resolution: this.resolution,
            blockLimit: this.blockLimit, orientation: this.orientation, flip: this.flip, vertexArray: this.vertexArray, theme: this.themeService,
            highlighting: this.auditHighlighting, animationDuration: this.animationDuration, animationOffset: this.animationOffset,
          colorFunction: this.getColorFunction() });
          this.start();
        }
      }
    }
  }

  compileShader(src, type): WebGLShader {
    if (!this.gl) {
      return;
    }
    const shader = this.gl.createShader(type);

    this.gl.shaderSource(shader, src);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.log(`Error compiling ${type === this.gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader:`);
      console.log(this.gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  buildShaderProgram(shaderInfo): WebGLProgram {
    if (!this.gl) {
      return;
    }
    const program = this.gl.createProgram();

    shaderInfo.forEach((desc) => {
      const shader = this.compileShader(desc.src, desc.type);
      if (shader) {
        this.gl.attachShader(program, shader);
      }
    });

    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.log('Error linking shader program:');
      console.log(this.gl.getProgramInfoLog(program));
    }

    return program;
  }

  start(): void {
    this.running = true;
    this.ngZone.runOutsideAngular(() => this.doRun());
  }

  doRun(): void {
    if (this.animationFrameRequest) {
      cancelAnimationFrame(this.animationFrameRequest);
    }
    this.animationFrameRequest = requestAnimationFrame(() => this.run());
  }

  run(now?: DOMHighResTimeStamp): void {
    if (!now) {
      now = performance.now();
    }
    this.applyQueuedUpdates();
    // skip re-render if there's no change to the scene
    if (this.scenes.length && this.gl) {
      /* SET UP SHADER UNIFORMS */
      // screen dimensions
      this.gl.uniform2f(this.gl.getUniformLocation(this.shaderProgram, 'screenSize'), this.displayWidth, this.displayHeight);
      // frame timestamp
      this.gl.uniform1f(this.gl.getUniformLocation(this.shaderProgram, 'now'), now);

      if (this.vertexArray.dirty) {
        /* SET UP SHADER ATTRIBUTES */
        Object.keys(attribs).forEach((key, i) => {
          this.gl.vertexAttribPointer(attribs[key].pointer,
          attribs[key].count,  // number of primitives in this attribute
          this.gl[attribs[key].type],  // type of primitive in this attribute (e.g. gl.FLOAT)
          false, // never normalised
          stride,   // distance between values of the same attribute
          attribs[key].offset);  // offset of the first value
        });

        const pointArray = this.vertexArray.getVertexData();

        if (pointArray.length) {
          this.gl.bufferData(this.gl.ARRAY_BUFFER, pointArray, this.gl.DYNAMIC_DRAW);
          this.gl.drawArrays(this.gl.TRIANGLES, 0, pointArray.length / TxSprite.vertexSize);
        }
        this.vertexArray.dirty = false;
      } else {
        const pointArray = this.vertexArray.getVertexData();
        if (pointArray.length) {
          this.gl.drawArrays(this.gl.TRIANGLES, 0, pointArray.length / TxSprite.vertexSize);
        }
      }

      if (this.readyNextFrame) {
        this.readyNextFrame = false;
        this.readyEvent.emit();
      }
    }

    /* LOOP */
    if (this.running && this.scenes.length && now <= (this.scenes.reduce((max, scene) => scene.animateUntil > max ? scene.animateUntil : max, 0) + 500)) {
      this.doRun();
    } else {
      if (this.animationHeartBeat) {
        clearTimeout(this.animationHeartBeat);
      }
      this.animationHeartBeat = window.setTimeout(() => {
        this.start();
      }, 1000);
    }
  }

  setHighlightingEnabled(enabled: boolean): void {
    for (const scene of this.scenes) {
      scene.setHighlighting(enabled);
    }
    this.start();
  }

  getColorFunction(): ((tx: TxView) => Color) {
    if (this.overrideColors) {
      return this.overrideColors;
    } else if (this.filterFlags) {
      return this.getFilterColorFunction(this.filterFlags, this.gradientMode);
    } else if (this.activeFilterFlags) {
      return this.getFilterColorFunction(this.activeFilterFlags, this.gradientMode);
    } else {
      return this.getFilterColorFunction(0n, this.gradientMode);
    }
  }

  getFilterColorFunction(flags: bigint, gradient: 'fee' | 'age'): ((tx: TxView) => Color) {
    return (tx: TxView) => {
      if ((this.filterMode === 'and' && (tx.bigintFlags & flags) === flags) || (this.filterMode === 'or' && (flags === 0n || (tx.bigintFlags & flags) > 0n))) {
        if (this.themeService.theme !== 'contrast' && this.themeService.theme !== 'bukele') {
          return (gradient === 'age') ? ageColorFunction(tx, defaultColors.fee, defaultAuditColors, this.relativeTime || (Date.now() / 1000)) : defaultColorFunction(tx, defaultColors.fee, defaultAuditColors, this.relativeTime || (Date.now() / 1000));
        } else {
          return (gradient === 'age') ? ageColorFunction(tx, contrastColors.fee, contrastAuditColors, this.relativeTime || (Date.now() / 1000)) : contrastColorFunction(tx, contrastColors.fee, contrastAuditColors, this.relativeTime || (Date.now() / 1000));
        }
      } else {
        if (this.themeService.theme !== 'contrast' && this.themeService.theme !== 'bukele') {
          return (gradient === 'age') ? { r: 1, g: 1, b: 1, a: 0.05 } : defaultColorFunction(
            tx,
            defaultColors.unmatchedfee,
            unmatchedAuditColors,
            this.relativeTime || (Date.now() / 1000)
          );
        } else {
          return (gradient === 'age') ? { r: 1, g: 1, b: 1, a: 0.05 } : contrastColorFunction(
            tx,
            contrastColors.unmatchedfee,
            unmatchedContrastAuditColors,
            this.relativeTime || (Date.now() / 1000)
          );
        }
      }
    };
  }
}

// WebGL shader attributes
const attribs = {
  bounds: { type: 'FLOAT', count: 4, pointer: null, offset: 0 },
  posX: { type: 'FLOAT', count: 4, pointer: null, offset: 0 },
  posY: { type: 'FLOAT', count: 4, pointer: null, offset: 0 },
  colR: { type: 'FLOAT', count: 4, pointer: null, offset: 0 },
  colG: { type: 'FLOAT', count: 4, pointer: null, offset: 0 },
  colB: { type: 'FLOAT', count: 4, pointer: null, offset: 0 },
  colA: { type: 'FLOAT', count: 4, pointer: null, offset: 0 }
};
// Calculate the number of bytes per vertex based on specified attributes
const stride = Object.values(attribs).reduce((total, attrib) => {
  return total + (attrib.count * 4);
}, 0);
// Calculate vertex attribute offsets
for (let i = 0, offset = 0; i < Object.keys(attribs).length; i++) {
  const attrib = Object.values(attribs)[i];
  attrib.offset = offset;
  offset += (attrib.count * 4);
}

const vertShaderSrc = `
varying lowp vec4 vColor;

// each attribute contains [x: startValue, y: endValue, z: startTime, w: rate]
// shader interpolates between start and end values at the given rate, from the given time

attribute vec4 bounds;
attribute vec4 posX;
attribute vec4 posY;
attribute vec4 colR;
attribute vec4 colG;
attribute vec4 colB;
attribute vec4 colA;

uniform vec2 screenSize;
uniform float now;

float smootherstep(float x) {
  x = clamp(x, 0.0, 1.0);
  float ix = 1.0 - x;
  x = x * x;
  return x / (x + ix * ix);
}

float interpolateAttribute(vec4 attr) {
  float d = (now - attr.z) * attr.w;
  float delta = smootherstep(d);
  return mix(attr.x, attr.y, delta);
}

void main() {
  vec4 screenTransform = vec4(2.0 / screenSize.x, 2.0 / screenSize.y, -1.0, -1.0);
  // vec4 screenTransform = vec4(1.0 / screenSize.x, 1.0 / screenSize.y, -0.5, -0.5);
  vec2 position = clamp(vec2(interpolateAttribute(posX), interpolateAttribute(posY)), bounds.xy, bounds.zw);
  gl_Position = vec4(position * screenTransform.xy + screenTransform.zw, 1.0, 1.0);

  float red = interpolateAttribute(colR);
  float green = interpolateAttribute(colG);
  float blue = interpolateAttribute(colB);
  float alpha = interpolateAttribute(colA);

  vColor = vec4(red, green, blue, alpha);
}
`;

const fragShaderSrc = `
varying lowp vec4 vColor;

void main() {
  gl_FragColor = vColor;
  // premultiply alpha
  gl_FragColor.rgb *= gl_FragColor.a;
}
`;
