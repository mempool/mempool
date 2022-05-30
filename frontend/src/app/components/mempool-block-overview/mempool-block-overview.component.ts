import { Component, ElementRef, ViewChild, HostListener, Input, OnInit, OnDestroy,  OnChanges, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { MempoolBlockWithTransactions } from 'src/app/interfaces/websocket.interface';
import { Observable, Subscription } from 'rxjs';
import { WebsocketService } from 'src/app/services/websocket.service';
import { FastVertexArray } from './fast-vertex-array';
import BlockScene from './block-scene';
import TxSprite from './tx-sprite';
import TxView from './tx-view';

@Component({
  selector: 'app-mempool-block-overview',
  templateUrl: './mempool-block-overview.component.html',
  styleUrls: ['./mempool-block-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolBlockOverviewComponent implements OnInit, OnDestroy, OnChanges {
  @Input() index: number;

  @ViewChild('blockCanvas')
  canvas: ElementRef<HTMLCanvasElement>;

  gl: WebGLRenderingContext;
  animationFrameRequest: number;
  displayWidth: number;
  displayHeight: number;
  shaderProgram: WebGLProgram;
  vertexArray: FastVertexArray;
  running: boolean;
  scene: BlockScene;
  txViews: { [key: string]: TxView };
  lastBlockHeight: number;
  blockIndex: number;

  sub: Subscription;
  mempoolBlock$: Observable<MempoolBlockWithTransactions>;

  constructor(
    public stateService: StateService,
    private websocketService: WebsocketService,
    readonly _ngZone: NgZone,
  ) {
    this.vertexArray = new FastVertexArray(512, TxSprite.dataSize)
    this.txViews = {}
  }

  ngOnInit(): void {
    this.websocketService.startTrackMempoolBlock(this.index);
    this.mempoolBlock$ = this.stateService.mempoolBlock$
    this.sub = this.mempoolBlock$.subscribe((block) => {
      this.updateBlock(block)
    })
  }

  ngAfterViewInit(): void {
    this.canvas.nativeElement.addEventListener("webglcontextlost", this.handleContextLost, false)
    this.canvas.nativeElement.addEventListener("webglcontextrestored", this.handleContextRestored, false)
    this.gl = this.canvas.nativeElement.getContext('webgl')
    this.initCanvas()

    this.resizeCanvas()
  }

  ngOnChanges(changes): void {
    if (changes.index) {
      this.clearBlock(changes.index.currentValue)
      this.websocketService.startTrackMempoolBlock(changes.index.currentValue);
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    this.websocketService.stopTrackMempoolBlock();
  }

  clearBlock(index: number): void {
    if (this.scene && index != this.blockIndex) {
      const direction = (this.blockIndex == null || this.index < this.blockIndex) ? 'left' : 'right'
      const removed = this.scene.exit(direction)
      setTimeout(() => {
        removed.forEach(tx => tx.destroy())
      }, 1000)
      this.txViews = {}
      this.scene = null
    }
  }

  updateBlock(block: MempoolBlockWithTransactions): void {
    if (!this.scene) {
      this.scene = new BlockScene({ width: this.displayWidth, height: this.displayHeight, resolution: 75, blockLimit: this.stateService.blockVSize })
    }
    const blockMined = (this.stateService.latestBlockHeight > this.lastBlockHeight)

    const nextIds = {}
    let remove = []
    let add = []
    block.transactions.forEach(tx => {
      nextIds[tx.txid] = true
    })

    // List old transactions to remove
    Object.keys(this.txViews).forEach(txid => {
      if (!nextIds[txid]) {
        remove.push(this.txViews[txid])
        delete this.txViews[txid]
      }
    })

    // List new transactions to add
    block.transactions.forEach(tx => {
      if (!this.txViews[tx.txid]) {
        const txView = new TxView(tx, this.vertexArray)
        this.txViews[tx.txid] = txView
        add.push(txView)
      }
    })

    if (this.blockIndex != this.index) {
      const direction = (this.blockIndex == null || this.index < this.blockIndex) ? 'left' : 'right'
      this.scene.enter(Object.values(this.txViews), direction)
    } else if (blockMined) {
      this.scene.replace(Object.values(this.txViews), remove, 'right')
    } else {
      this.scene.replace(Object.values(this.txViews), remove, 'left')
    }

    this.lastBlockHeight = this.stateService.latestBlockHeight
    this.blockIndex = this.index
  }

  initCanvas (): void {
    this.gl.clearColor(0.0, 0.0, 0.0, 0.0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    const shaderSet = [
      {
        type: this.gl.VERTEX_SHADER,
        src: vertShaderSrc
      },
      {
        type: this.gl.FRAGMENT_SHADER,
        src: fragShaderSrc
      }
    ]

    this.shaderProgram = this.buildShaderProgram(shaderSet)

    this.gl.useProgram(this.shaderProgram)

    // Set up alpha blending
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);

    const glBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, glBuffer)

    /* SET UP SHADER ATTRIBUTES */
    Object.keys(attribs).forEach((key, i) => {
      attribs[key].pointer = this.gl.getAttribLocation(this.shaderProgram, key)
      this.gl.enableVertexAttribArray(attribs[key].pointer);
    })

    this.start()
  }

  handleContextLost(event): void {
    event.preventDefault()
    cancelAnimationFrame(this.animationFrameRequest)
    this.animationFrameRequest = null
    this.running = false
  }

  handleContextRestored(event): void {
    this.initCanvas()
  }

  @HostListener('window:resize', ['$event'])
  resizeCanvas(): void {
    this.displayWidth = this.canvas.nativeElement.parentElement.clientWidth
    this.displayHeight = this.canvas.nativeElement.parentElement.clientHeight
    this.canvas.nativeElement.width = this.displayWidth
    this.canvas.nativeElement.height = this.displayHeight
    if (this.gl) this.gl.viewport(0, 0, this.canvas.nativeElement.width, this.canvas.nativeElement.height)
    if (this.scene) this.scene.resize({ width: this.displayWidth, height: this.displayHeight })
  }

  compileShader(src, type): WebGLShader {
    let shader = this.gl.createShader(type)

    this.gl.shaderSource(shader, src)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.log(`Error compiling ${type === this.gl.VERTEX_SHADER ? "vertex" : "fragment"} shader:`)
      console.log(this.gl.getShaderInfoLog(shader))
    }
    return shader
  }

  buildShaderProgram(shaderInfo): WebGLProgram {
    let program = this.gl.createProgram()

    shaderInfo.forEach((desc) => {
      let shader = this.compileShader(desc.src, desc.type)
      if (shader) {
        this.gl.attachShader(program, shader)
      }
    })

    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.log("Error linking shader program:")
      console.log(this.gl.getProgramInfoLog(program))
    }

    return program
  }

  start(): void {
    this.running = true
    this._ngZone.runOutsideAngular(() => this.run())
  }

  run (now?: DOMHighResTimeStamp): void {
    if (!now) {
      now = performance.now()
    }

    /* SET UP SHADER UNIFORMS */
    // screen dimensions
    this.gl.uniform2f(this.gl.getUniformLocation(this.shaderProgram, 'screenSize'), this.displayWidth, this.displayHeight)
    // frame timestamp
    this.gl.uniform1f(this.gl.getUniformLocation(this.shaderProgram, 'now'), now)

    /* SET UP SHADER ATTRIBUTES */
    Object.keys(attribs).forEach((key, i) => {
      this.gl.vertexAttribPointer(attribs[key].pointer,
      attribs[key].count,  // number of primitives in this attribute
      this.gl[attribs[key].type],  // type of primitive in this attribute (e.g. gl.FLOAT)
      false, // never normalised
      stride,   // distance between values of the same attribute
      attribs[key].offset);  // offset of the first value
    })

    const pointArray = this.vertexArray.getVertexData()

    if (pointArray.length) {
      this.gl.bufferData(this.gl.ARRAY_BUFFER, pointArray, this.gl.DYNAMIC_DRAW)
      this.gl.drawArrays(this.gl.TRIANGLES, 0, pointArray.length / TxSprite.vertexSize)
    }

    /* LOOP */
    if (this.running) {
      if (this.animationFrameRequest) {
        cancelAnimationFrame(this.animationFrameRequest)
        this.animationFrameRequest = null
      }
      this.animationFrameRequest = requestAnimationFrame(() => this.run());
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
}
// Calculate the number of bytes per vertex based on specified attributes
const stride = Object.values(attribs).reduce((total, attrib) => {
  return total + (attrib.count * 4)
}, 0)
// Calculate vertex attribute offsets
for (let i = 0, offset = 0; i < Object.keys(attribs).length; i++) {
  let attrib = Object.values(attribs)[i]
  attrib.offset = offset
  offset += (attrib.count * 4)
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
`

const fragShaderSrc = `
varying lowp vec4 vColor;

void main() {
  gl_FragColor = vColor;
  // premultiply alpha
  gl_FragColor.rgb *= gl_FragColor.a;
}
`
