import { Component, ElementRef, ViewChild, HostListener, Input, Output, EventEmitter, NgZone, AfterViewInit, OnDestroy } from '@angular/core';
import { TransactionStripped } from 'src/app/interfaces/websocket.interface';
import { FastVertexArray } from './fast-vertex-array';
import BlockScene from './block-scene';
import TxSprite from './tx-sprite';
import TxView from './tx-view';
import { Position } from './sprite-types';

@Component({
  selector: 'app-block-overview-graph',
  templateUrl: './block-overview-graph.component.html',
  styleUrls: ['./block-overview-graph.component.scss'],
})
export class BlockOverviewGraphComponent implements AfterViewInit, OnDestroy {
  @Input() isLoading: boolean;
  @Input() resolution: number;
  @Input() blockLimit: number;
  @Input() orientation = 'left';
  @Input() flip = true;
  @Output() txClickEvent = new EventEmitter<TransactionStripped>();

  @ViewChild('blockCanvas')
  canvas: ElementRef<HTMLCanvasElement>;

  gl: WebGLRenderingContext;
  animationFrameRequest: number;
  animationHeartBeat: number;
  displayWidth: number;
  displayHeight: number;
  cssWidth: number;
  cssHeight: number;
  shaderProgram: WebGLProgram;
  vertexArray: FastVertexArray;
  running: boolean;
  scene: BlockScene;
  hoverTx: TxView | void;
  selectedTx: TxView | void;
  tooltipPosition: Position;

  constructor(
    readonly ngZone: NgZone,
    readonly elRef: ElementRef,
  ) {
    this.vertexArray = new FastVertexArray(512, TxSprite.dataSize);
  }

  ngAfterViewInit(): void {
    this.canvas.nativeElement.addEventListener('webglcontextlost', this.handleContextLost, false);
    this.canvas.nativeElement.addEventListener('webglcontextrestored', this.handleContextRestored, false);
    this.gl = this.canvas.nativeElement.getContext('webgl');
    this.initCanvas();

    this.resizeCanvas();
  }

  ngOnDestroy(): void {
    if (this.animationFrameRequest) {
      cancelAnimationFrame(this.animationFrameRequest);
      clearTimeout(this.animationHeartBeat);
    }
  }

  clear(direction): void {
    this.exit(direction);
    this.hoverTx = null;
    this.selectedTx = null;
    this.start();
  }

  destroy(): void {
    if (this.scene) {
      this.scene.destroy();
      this.start();
    }
  }

  // initialize the scene without any entry transition
  setup(transactions: TransactionStripped[]): void {
    if (this.scene) {
      this.scene.setup(transactions);
      this.start();
    }
  }

  enter(transactions: TransactionStripped[], direction: string): void {
    if (this.scene) {
      this.scene.enter(transactions, direction);
      this.start();
    }
  }

  exit(direction: string): void {
    if (this.scene) {
      this.scene.exit(direction);
      this.start();
    }
  }

  replace(transactions: TransactionStripped[], direction: string, sort: boolean = true): void {
    if (this.scene) {
      this.scene.replace(transactions || [], direction, sort);
      this.start();
    }
  }

  update(add: TransactionStripped[], remove: string[], direction: string = 'left', resetLayout: boolean = false): void {
    if (this.scene) {
      this.scene.update(add, remove, direction, resetLayout);
      this.start();
    }
  }

  initCanvas(): void {
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
  }

  handleContextRestored(event): void {
    this.initCanvas();
  }

  @HostListener('window:resize', ['$event'])
  resizeCanvas(): void {
    this.cssWidth = this.canvas.nativeElement.offsetParent.clientWidth;
    this.cssHeight = this.canvas.nativeElement.offsetParent.clientHeight;
    this.displayWidth = window.devicePixelRatio * this.cssWidth;
    this.displayHeight = window.devicePixelRatio * this.cssHeight;
    this.canvas.nativeElement.width = this.displayWidth;
    this.canvas.nativeElement.height = this.displayHeight;
    if (this.gl) {
      this.gl.viewport(0, 0, this.displayWidth, this.displayHeight);
    }
    if (this.scene) {
      this.scene.resize({ width: this.displayWidth, height: this.displayHeight });
      this.start();
    } else {
      this.scene = new BlockScene({ width: this.displayWidth, height: this.displayHeight, resolution: this.resolution,
        blockLimit: this.blockLimit, orientation: this.orientation, flip: this.flip, vertexArray: this.vertexArray });
      this.start();
    }
  }

  compileShader(src, type): WebGLShader {
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
    // skip re-render if there's no change to the scene
    if (this.scene) {
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
    }

    /* LOOP */
    if (this.running && this.scene && now <= (this.scene.animateUntil + 500)) {
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

  @HostListener('document:click', ['$event'])
  clickAway(event) {
    if (!this.elRef.nativeElement.contains(event.target)) {
      const currentPreview = this.selectedTx || this.hoverTx;
      if (currentPreview && this.scene) {
        this.scene.setHover(currentPreview, false);
        this.start();
      }
      this.hoverTx = null;
      this.selectedTx = null;
    }
  }

  @HostListener('pointerup', ['$event'])
  onClick(event) {
    if (event.target === this.canvas.nativeElement && event.pointerType === 'touch') {
      this.setPreviewTx(event.offsetX, event.offsetY, true);
    } else if (event.target === this.canvas.nativeElement) {
      this.onTxClick(event.offsetX, event.offsetY);
    }
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event) {
    if (event.target === this.canvas.nativeElement) {
      this.setPreviewTx(event.offsetX, event.offsetY, false);
    }
  }

  @HostListener('pointerleave', ['$event'])
  onPointerLeave(event) {
    if (event.pointerType !== 'touch') {
      this.setPreviewTx(-1, -1, true);
    }
  }

  setPreviewTx(cssX: number, cssY: number, clicked: boolean = false) {
    const x = cssX * window.devicePixelRatio;
    const y = cssY * window.devicePixelRatio;
    if (this.scene && (!this.selectedTx || clicked)) {
      this.tooltipPosition = {
        x: cssX,
        y: cssY
      };
      const selected = this.scene.getTxAt({ x, y });
      const currentPreview = this.selectedTx || this.hoverTx;

      if (selected !== currentPreview) {
        if (currentPreview && this.scene) {
          this.scene.setHover(currentPreview, false);
          this.start();
        }
        if (selected) {
          if (selected && this.scene) {
            this.scene.setHover(selected, true);
            this.start();
          }
          if (clicked) {
            this.selectedTx = selected;
          } else {
            this.hoverTx = selected;
          }
        } else {
          if (clicked) {
            this.selectedTx = null;
          }
          this.hoverTx = null;
        }
      } else if (clicked) {
        if (selected === this.selectedTx) {
          this.hoverTx = this.selectedTx;
          this.selectedTx = null;
        } else {
          this.selectedTx = selected;
        }
      }
    }
  }

  onTxClick(cssX: number, cssY: number) {
    const x = cssX * window.devicePixelRatio;
    const y = cssY * window.devicePixelRatio;
    const selected = this.scene.getTxAt({ x, y });
    if (selected && selected.txid) {
      this.txClickEvent.emit(selected);
    }
  }
}

// WebGL shader attributes
const attribs = {
  offset: { type: 'FLOAT', count: 2, pointer: null, offset: 0 },
  posX: { type: 'FLOAT', count: 4, pointer: null, offset: 0 },
  posY: { type: 'FLOAT', count: 4, pointer: null, offset: 0 },
  posR: { type: 'FLOAT', count: 4, pointer: null, offset: 0 },
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

attribute vec2 offset;
attribute vec4 posX;
attribute vec4 posY;
attribute vec4 posR;
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

  float radius = interpolateAttribute(posR);
  vec2 position = vec2(interpolateAttribute(posX), interpolateAttribute(posY)) + (radius * offset);

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
