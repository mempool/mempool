import { AfterViewChecked, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostBinding, Input, NgZone, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { Transaction } from '@interfaces/electrs.interface';
import { BudgetExceeded, buildProgram, HASH_OPS, isHandover, OpCategory, OPCODES, pushLabels, ScriptOp, ScriptProgram, ScriptSection, ScriptVM, Step, withinBudget } from '@app/shared/script-vm';

interface Block {
  ops: number[]; // more than one when a not-executed run is folded
  x: number;
  y: number;
  width: number;
  hexW: number; // 0 for witness items, which have no opcode byte
  hex: string;
  name: string;
  category: OpCategory;
  notExecuted: boolean;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  inner?: boolean;
}

// a stack value, and a key that only changes when the item does (its position from the bottom + its value),
// so a step only re-renders the items it changed instead of the whole stack
interface StackItem {
  v: string;
  k: string;
}

// stack items top first: about to be added (faded), about to be used (white stroke), the rest
interface StackView {
  pending: StackItem[];
  read: StackItem[];
  rest: StackItem[];
}

// steps that aren't an opcode, drawn as clickable chips: the P2SH / witness handover and the end
interface Chip {
  x: number;
  y: number;
  width: number;
  label: string;
  kind: 'handover' | 'valid' | 'invalid';
  step: number;
}

// how a stack item arrives on the step after the op that added it; `from` is the slot it slides from (+ = below)
interface ItemAnim {
  cls: 'enter-push' | 'enter-move' | 'enter-replace' | 'enter-alt-left' | 'enter-alt-right';
  from?: number;
}

interface Tooltip {
  title: string;
  label?: string;
  text?: string;
  hex?: string;
  notExecuted?: boolean;
  error?: string;
  valid?: boolean;
  note?: string;
}

const SIG_OPS = new Set([0xac, 0xad, 0xae, 0xaf, 0xba]); // CHECKSIG(VERIFY), CHECKMULTISIG(VERIFY), CHECKSIGADD

// smooth scrolling, unless the user asked for reduced motion (the CSS media query doesn't reach JS scrolls)
export function scrollBehavior(animate = true): ScrollBehavior {
  return animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto';
}

const PAD = 16;
const BOX_PAD = 16; // leaves room for the ▶ marker left of the blocks
const INNER_PAD = 6;
const INNER_LABEL_GAP = 14; // room above a nested box for its label on the top edge
const INNER_GAP = 8; // space below a nested box
const STACK_DRAWN = 25; // stack items drawn from the top (the pane shows ~10); "+N more" draws the rest on demand
const RENDER_MARGIN = 2000; // px drawn above and below the visible part of the script pane: generous, so fast scrolling doesn't outrun it
const INDENT = 16; // per IF / NOTIF nesting level, like code
const BOX_GAP = 18;
// block sizes: desktop, mobile; charW is a fallback estimate of the bold block font's character width when text can't be measured (SSR)
const SIZES = {
  desktop: { blockH: 34, hexW: 40, font: 16, charW: 10.5 },
  mobile: { blockH: 36, hexW: 36, font: 14, charW: 9.2 }, // taller blocks, easier to tap
};
const LABEL_CHAR_W = 7; // estimate for the 12px section labels
const CHIP_H = 24;
const CHIP_FONT = 12;
const FOLD_MIN = 6; // fold runs of this many not-executed ops (inscription envelopes)
const TOOLTIP_HEX_MAX = 600;
// icon next to a stack item whose value was recognised
const LABEL_ICONS = new Map([
  [pushLabels.signature, 'signature'],
  [pushLabels.publicKey, 'key'],
  [pushLabels.publicKeyHash, 'hashtag'],
  [pushLabels.scriptHash, 'hashtag'],
  [pushLabels.hash, 'hashtag'],
  [pushLabels.redeemScript, 'code'],
]);
const COPY_OPS = new Set(['OP_DUP', 'OP_2DUP', 'OP_3DUP', 'OP_OVER', 'OP_2OVER', 'OP_PICK', 'OP_TUCK', 'OP_IFDUP']);
const MOVE_OPS = new Set(['OP_SWAP', 'OP_ROT', 'OP_2SWAP', 'OP_2ROT', 'OP_ROLL']);
const BRANCH_OPS = new Set([0x63, 0x64, 0x67]); // IF, NOTIF, ELSE

@Component({
  selector: 'app-script-debugger',
  templateUrl: './script-debugger.component.html',
  styleUrls: ['./script-debugger.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScriptDebuggerComponent implements OnChanges, AfterViewChecked, OnDestroy {
  @Input() tx: Transaction;
  @Input() vinIndex: number;
  @Input() isMobile = false;
  @Output() hide = new EventEmitter<void>();

  @ViewChild('scriptPane') scriptPane: ElementRef<HTMLDivElement>;
  @ViewChild('stackScroll') stackScroll: ElementRef<HTMLDivElement>;
  @ViewChild('tooltipEl') tooltipEl: ElementRef<HTMLDivElement>;
  @HostBinding('attr.tabindex') tabindex = 0; // focusable, for the arrow keys
  @HostBinding('class.animate') animate = false; // only a single step forward animates; jumps and going back snap

  blockH = SIZES.desktop.blockH;
  hexW = SIZES.desktop.hexW;
  blockFont = SIZES.desktop.font;
  private charW = SIZES.desktop.charW;
  private allSteps: Step[] = [];
  readonly labelCharW = LABEL_CHAR_W;

  program: ScriptProgram | null = null;
  tooLarge = false; // over the memory budget, so not run
  steps: Step[] = []; // only the steps that can be navigated to (folded runs keep their first step)
  blocks: Block[] = [];
  boxes: Box[] = [];
  chips: Chip[] = [];
  guides: { x: number, y1: number, y2: number }[] = []; // indent guides from each IF down to its ENDIF
  // only what's near the visible part of the script pane is drawn, so huge scripts (BitVM, thousands of ops) stay fast
  visibleBlocks: Block[] = [];
  visibleBoxes: Box[] = [];
  visibleGuides: { x: number, y1: number, y2: number }[] = [];
  private windowFrame = 0;
  private lastStepAt = 0;
  private destroyed = false; // a pending timeout or frame must not update a closed debugger
  private rapid = false; // the last step came right after the one before (a held arrow key)
  readonly chipH = CHIP_H;
  blockByOp = new Map<number, Block>();
  svgWidth = 0;
  svgHeight = 0;
  index = 0;

  mainView: StackView = { pending: [], read: [], rest: [] };
  altView: StackView = { pending: [], read: [], rest: [] };
  showAlt = false;
  valid = false;
  hiddenBelow = 0;
  notDrawn = 0; // stack items below the drawn top (see STACK_DRAWN), counted in "+N more"
  atDrawnEnd = false; // scrolled to the last drawn item while more aren't drawn: the legend offers "Show all"
  private drawWholeStack = false; // "+N more" was clicked: draw every stack item
  expanded: string | null = null; // item tapped to show its full value
  mainAnims: ItemAnim[] = []; // by top-first position in read + rest
  altAnims: ItemAnim[] = [];
  mainGhosts: string[] = []; // items the last op removed, fading out
  leaving = false; // the next op removes the items it reads without adding anything (DROP, VERIFY, …)
  dimStagger = new Map<number, number>(); // op index → order, for blocks dimming after IF / NOTIF / ELSE
  private notExecutedOps = new Set<number>();
  labelByValue = new Map<string, string>(); // recognised pushes, so copies and computed values (DUP, HASH160) get them too
  readonly labelIcons = LABEL_ICONS;

  handoverLabels = {
    p2sh: $localize`:@@script-debugger.handover:P2SH handover`,
    witness: $localize`:@@script-debugger.witness-handover:Witness handover`,
  };
  endLabels = {
    valid: $localize`:@@script-debugger.valid:Valid ✓`,
    invalid: $localize`:@@script-debugger.invalid:Invalid`,
  };

  sectionLabels: Record<ScriptSection, string> = {
    scriptsig: $localize`:@@script-debugger.section.scriptsig:ScriptSig`,
    scriptpubkey: $localize`:@@script-debugger.section.scriptpubkey:ScriptPubKey`,
    witness: $localize`:@@script-debugger.section.witness:Witness`,
    redeemscript: $localize`:@@script-debugger.section.redeemscript:Redeem script`,
    witnessscript: $localize`:@@script-debugger.section.witnessscript:Witness script`,
    tapscript: $localize`:@@script-debugger.section.tapscript:Tapscript`,
    template: $localize`:@@script-debugger.section.implicit-script:Implicit script`,
  };

  private measureCtx: CanvasRenderingContext2D | null | undefined;

  // keys and scrolling are listened to outside Angular: a held arrow key or a smooth scroll fires ~120 events a second,
  // and each would otherwise run change detection for the whole app. Only this component is updated, and only when needed
  constructor(private cd: ChangeDetectorRef, private host: ElementRef<HTMLElement>, zone: NgZone) {
    zone.runOutsideAngular(() => {
      host.nativeElement.addEventListener('keydown', this.onKeydown);
      host.nativeElement.addEventListener('scroll', this.onScroll, { capture: true, passive: true }); // scroll doesn't bubble
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.host.nativeElement.removeEventListener('keydown', this.onKeydown);
    this.host.nativeElement.removeEventListener('scroll', this.onScroll, { capture: true });
    cancelAnimationFrame(this.windowFrame);
  }

  private onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    // a focused stack item is redrawn by the step, which would drop focus and stop the arrow keys
    this.host.nativeElement.focus({ preventScroll: true });
    if (event.key === 'ArrowRight') {
      this.next();
    } else {
      this.prev();
    }
    this.cd.detectChanges();
  };

  private onScroll = (event: Event): void => {
    if (event.target === this.stackScroll?.nativeElement) {
      this.updateScrollState();
    } else if (event.target === this.scriptPane?.nativeElement && !this.windowFrame) {
      this.windowFrame = requestAnimationFrame(() => {
        this.windowFrame = 0;
        if (this.updateWindow()) {
          this.cd.detectChanges();
        }
      });
    }
  };

  // width of a block name in the bold block font, measured so wide letters (PUSHNUM, M, W) get their padding
  private textWidth(text: string, fontSize = this.blockFont): number {
    if (this.measureCtx === undefined) {
      this.measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    }
    if (!this.measureCtx) {
      return text.length * this.charW * fontSize / this.blockFont;
    }
    this.measureCtx.font = `700 ${fontSize}px ${getComputedStyle(document.body).fontFamily}`;
    return this.measureCtx.measureText(text).width;
  }

  ngOnChanges(changes: SimpleChanges): void {
    const size = this.isMobile ? SIZES.mobile : SIZES.desktop;
    ({ blockH: this.blockH, hexW: this.hexW, font: this.blockFont, charW: this.charW } = size);
    if (!changes.tx && !changes.vinIndex) {
      // only isMobile changed: lay out again at the new size, staying on the same step
      if (this.program) {
        this.layout(this.allSteps);
        this.assignChipSteps();
        setTimeout(() => this.scrollToCurrent());
      }
      return;
    }
    const vin = this.tx?.vin?.[this.vinIndex];
    const program = vin ? buildProgram(vin) : null;
    // too large to run in the browser (past the parse ceiling, or the run passes its memory budget): show a message instead
    let allSteps: Step[] | null = null;
    this.tooLarge = !!program && !withinBudget(program);
    if (program && !this.tooLarge) {
      try {
        allSteps = new ScriptVM().run(program);
      } catch (e) {
        if (!(e instanceof BudgetExceeded)) {
          throw e;
        }
        this.tooLarge = true;
      }
    }
    this.program = allSteps ? program : null;
    if (!this.program) {
      this.steps = [];
      this.blocks = [];
      this.boxes = [];
      this.guides = [];
      this.updateWindow();
      return;
    }
    this.allSteps = allSteps;
    this.labelByValue = new Map(this.program.ops.filter(op => op.data && op.label).map(op => [op.data, op.label]));
    // anything a hash opcode computed, unless a push already gave it a more specific label
    for (const step of allSteps) {
      const op = step.opIndex !== null ? this.program.ops[step.opIndex] : null;
      if (HASH_OPS.includes(op?.code) && !step.notExecuted && step.pushes[0] && !this.labelByValue.has(step.pushes[0])) {
        this.labelByValue.set(step.pushes[0], pushLabels.hash);
      }
    }
    this.layout(allSteps);
    this.steps = allSteps.filter(step => step.opIndex === null || this.blockByOp.get(step.opIndex)?.ops[0] === step.opIndex);
    this.assignChipSteps();
    this.index = 0;
    this.drawWholeStack = false;
    this.updateStack(null);
    setTimeout(() => this.scrollToCurrent());
  }

  get step(): Step | undefined {
    return this.steps[this.index];
  }

  get currentCategory(): OpCategory | null {
    return this.currentBlock?.category ?? null;
  }

  get currentBlock(): Block | undefined {
    const opIndex = this.step?.opIndex;
    return typeof opIndex === 'number' ? this.blockByOp.get(opIndex) : undefined;
  }

  get currentChip(): Chip | undefined {
    return this.chips.find(chip => chip.step === this.index);
  }

  // what the ▶ marker and the tooltip point at: the current block or chip
  get anchor(): { x: number, y: number, h: number } | undefined {
    const target = this.currentBlock ?? this.currentChip;
    if (target) {
      return { x: target.x, y: target.y, h: this.currentBlock ? this.blockH : CHIP_H };
    }
    const first = this.blocks[0];
    return first && { x: first.x, y: first.y, h: this.blockH };
  }

  next(): void {
    this.goTo(this.index + 1);
  }

  prev(): void {
    this.goTo(this.index - 1);
  }

  restart(): void {
    this.goTo(0);
  }

  goTo(index: number): void {
    if (index < 0 || index >= this.steps.length || index === this.index) {
      return;
    }
    const executed = index === this.index + 1 ? this.step : null;
    this.index = index;
    // steps coming faster than a smooth scroll lasts (a held key): jump instead of starting another scroll every step
    const now = performance.now();
    this.rapid = now - this.lastStepAt < 200;
    this.lastStepAt = now;
    this.updateStack(executed);
    this.cd.markForCheck();
    setTimeout(() => this.scrollToCurrent());
  }

  goToBlock(block: Block): void {
    const i = this.steps.findIndex(step => step.opIndex === block.ops[0]);
    // with OP_SUCCESS no tapscript op runs, so any of them jumps to the one that makes the script succeed
    this.goTo(i === -1 && this.steps[this.steps.length - 1]?.opSuccess ? this.steps.length - 1 : i);
  }

  get tooltip(): Tooltip | null {
    const step = this.step;
    if (!step) {
      return null;
    }
    if (step.opIndex === null) {
      if (step.result) {
        return step.result === 'valid'
          ? { title: this.endLabels.valid, valid: true,
            text: $localize`:@@script-debugger.valid-text:The script ended with a true item on the stack, so the input can be spent` }
          : { title: this.endLabels.invalid, error: step.error };
      }
      const toRedeem = this.program.emptyRedeem || this.program.ops[this.nextOpIndex()]?.section === 'redeemscript';
      return toRedeem
        ? { title: this.handoverLabels.p2sh,
          text: $localize`:@@script-debugger.handover-text:The redeem script matches the hash. The stack goes back to how ScriptSig left it, without the redeem script, and the redeem script runs on it` }
        : { title: this.handoverLabels.witness,
          text: $localize`:@@script-debugger.witness-handover-text:The witness program matches. The stack is cleared and the witness items take over` };
    }
    const block = this.blockByOp.get(step.opIndex);
    if (block.ops.length > 1) {
      return { title: $localize`:@@script-debugger.folded:${block.ops.length}:count: opcodes`, notExecuted: true,
        text: $localize`:@@script-debugger.folded-text:Inside a false IF branch, so the interpreter reads each opcode but doesn't execute it` };
    }
    const op = this.program.ops[step.opIndex];
    let tooltip: Tooltip;
    if (op.code === null && !op.data) {
      tooltip = { title: $localize`:@@script-debugger.empty-item:Empty item`,
        text: $localize`:@@script-debugger.empty-item-text:Pushes an empty item (zero, false) onto the stack. Often the dummy item CHECKMULTISIG consumes, a false condition for IF / NOTIF, or an empty signature that makes CHECKSIG return false` };
    } else if (op.code === null) {
      tooltip = { title: $localize`:@@script-debugger.witness-item:Witness item`, label: op.label, hex: op.data };
    } else {
      tooltip = { title: OPCODES[op.code].name, label: op.label, text: op.data ? undefined : OPCODES[op.code].description, hex: op.data || undefined };
      if (SIG_OPS.has(op.code)) {
        tooltip.note = $localize`:@@script-debugger.sig-not-verified:Not verified: any non-empty signature passes.`;
      }
    }
    if (tooltip.hex?.length > TOOLTIP_HEX_MAX) {
      tooltip.hex = tooltip.hex.slice(0, TOOLTIP_HEX_MAX) + '…';
    }
    tooltip.notExecuted = step.notExecuted;
    tooltip.error = step.error;
    if (step.opSuccess) {
      tooltip.valid = true;
      tooltip.text = $localize`:@@script-debugger.op-success:OP_SUCCESS: in tapscript this opcode makes the whole script succeed`;
    }
    return tooltip;
  }

  // executed: the step just run when moving one step forward, to animate what it did
  private updateStack(executed: Step | null): void {
    const step = this.step;
    this.expanded = null;
    this.animate = !!executed;
    this.mainAnims = [];
    this.altAnims = [];
    this.mainGhosts = [];
    this.dimStagger = new Map();
    if (!step) {
      return;
    }
    if (executed && !executed.notExecuted) {
      this.planAnimations(executed, step);
    }
    this.notDrawn = 0;
    const view = (stack: string[], reads: number, pushes: string[]): StackView => {
      const items = stack.map((v, pos) => ({ v, k: `${pos}:${v}` })).reverse();
      // only the top of a deep stack is drawn, so each step repaints a short column, not hundreds of items
      const drawn = this.drawWholeStack ? items.length : Math.min(items.length, Math.max(reads, STACK_DRAWN));
      this.notDrawn += items.length - drawn;
      return {
        pending: [...pushes].reverse().map((v, i) => ({ v, k: `p${this.index}:${i}` })), // new each step, so the pulse restarts
        read: items.slice(0, reads),
        rest: items.slice(reads, drawn),
      };
    };
    // SWAP / ROT / ROLL… only reorder the items they read: nothing new is added, so nothing to show as pending
    const op = step.opIndex !== null ? this.program.ops[step.opIndex] : null;
    const reorders = typeof op?.code === 'number' && MOVE_OPS.has(OPCODES[op.code].name);
    this.mainView = view(step.stack, Math.min(step.reads, step.stack.length), reorders ? [] : step.pushes);
    this.altView = view(step.alt, step.altReads, step.altPushes);
    this.showAlt = step.alt.length > 0 || step.altPushes.length > 0;
    const next = this.steps[this.index + 1];
    this.leaving = !!next && !step.pushes.length && next.stack.length < step.stack.length;
    this.valid = step.result === 'valid' && !step.opSuccess;
  }

  private planAnimations(executed: Step, step: Step): void {
    const op = executed.opIndex !== null ? this.program.ops[executed.opIndex] : null;
    const name = typeof op?.code === 'number' ? OPCODES[op.code].name : null;
    const before = [...executed.stack].reverse();
    const after = [...step.stack].reverse();
    const added = executed.pushes.length;
    const removed = before.length - (after.length - added);

    if (name === 'OP_TOALTSTACK') {
      this.altAnims[0] = { cls: 'enter-alt-left' };
    } else if (name === 'OP_FROMALTSTACK') {
      this.mainAnims[0] = { cls: 'enter-alt-right' };
    } else if (name && (COPY_OPS.has(name) || MOVE_OPS.has(name))) {
      // slide each item from where it was: positions count from the bottom, since the stack sits at the bottom
      const used = new Set<number>();
      for (let j = 0; j < added; j++) {
        let i = before.findIndex((item, k) => item === after[j] && !used.has(k));
        if (i === -1) {
          i = before.indexOf(after[j]);
        }
        used.add(i);
        this.mainAnims[j] = i === -1 ? { cls: 'enter-push' } : { cls: 'enter-move', from: after.length - before.length - j + i };
      }
    } else {
      const push = op && (op.code === null || OPCODES[op.code].category === 'push');
      for (let j = 0; j < added; j++) {
        this.mainAnims[j] = { cls: push ? 'enter-push' : 'enter-replace' };
      }
      this.mainGhosts = before.slice(0, Math.max(0, removed));
    }

    if (typeof op?.code === 'number' && BRANCH_OPS.has(op.code)) {
      let rank = 0;
      for (let i = executed.opIndex + 1; this.notExecutedOps.has(i); i++) {
        this.dimStagger.set(i, rank++);
      }
    }
  }

  // how many stack items are scrolled out of view below or not drawn at all, for "+N more" (the edge fades are pure CSS)
  updateScrollState(): void {
    const stack = this.stackScroll?.nativeElement;
    if (!stack || this.destroyed) {
      return;
    }
    const bottom = stack.scrollTop + stack.clientHeight;
    const scrolledOut = Array.from(stack.querySelectorAll<HTMLElement>('.stack-item'))
      .filter(item => item.offsetTop + item.offsetHeight / 2 > bottom).length;
    const hiddenBelow = this.notDrawn + scrolledOut;
    const atDrawnEnd = this.notDrawn > 0 && scrolledOut === 0;
    if (hiddenBelow !== this.hiddenBelow || atDrawnEnd !== this.atDrawnEnd) {
      this.hiddenBelow = hiddenBelow;
      this.atDrawnEnd = atDrawnEnd;
      this.cd.detectChanges(); // only ever called outside a change detection pass (a timeout or a scroll), maybe outside Angular
    }
  }

  // "+N more" clicked: draw the rest of the stack too (until another input is opened)
  drawAllStack(): void {
    if (!this.notDrawn) {
      return;
    }
    this.drawWholeStack = true;
    this.updateStack(null);
    this.cd.markForCheck();
    setTimeout(() => this.updateScrollState());
  }

  toggleExpanded(key: string): void {
    this.expanded = this.expanded === key ? null : key;
  }

  private nextOpIndex(): number {
    for (let i = this.index + 1; i < this.steps.length; i++) {
      if (this.steps[i].opIndex !== null) {
        return this.steps[i].opIndex;
      }
    }
    return -1;
  }

  // match the chips to their steps: handovers in order, then the final step
  private assignChipSteps(): void {
    const handovers = this.steps.map((step, i) => step.opIndex === null && !step.result ? i : -1).filter(i => i >= 0);
    let h = 0;
    for (const chip of this.chips) {
      chip.step = chip.kind === 'handover' ? handovers[h++] : this.steps.length - 1;
    }
  }

  private layout(steps: Step[]): void {
    const ops = this.program.ops;
    const notExecuted = new Set(steps.filter(step => step.notExecuted).map(step => step.opIndex));
    this.notExecutedOps = notExecuted;
    this.blocks = [];
    this.boxes = [];
    this.chips = [];
    this.guides = [];
    this.blockByOp.clear();
    let handovers = steps.filter(step => step.opIndex === null && !step.result).length;
    const addChip = (y: number, label: string, kind: Chip['kind']): void => {
      this.chips.push({ x: PAD + BOX_PAD, y, width: this.textWidth(label, CHIP_FONT) + 24, label, kind, step: -1 });
    };

    let y = PAD;
    let maxRight = 0;
    let i = 0;
    while (i < ops.length) {
      const section = ops[i].section;
      if (handovers && isHandover(ops[i - 1]?.section, section)) {
        addChip(y, section === 'redeemscript' ? this.handoverLabels.p2sh : this.handoverLabels.witness, 'handover');
        y += CHIP_H + BOX_GAP;
        handovers--;
      }
      const box: Box = { x: PAD, y, width: 0, height: 0, label: this.sectionLabels[section] };
      this.boxes.push(box);
      y += BOX_PAD;
      let boxRight = 0;
      let depth = 0;
      const openIfs: Block[] = [];
      while (i < ops.length && ops[i].section === section) {
        let run = 1;
        while (notExecuted.has(i) && notExecuted.has(i + run) && ops[i + run].section === section) {
          run++;
        }
        const folded = run >= FOLD_MIN;
        const op = ops[i];
        const indices = folded ? Array.from({ length: run }, (_, k) => i + k) : [i];
        const block = this.makeBlock(op, indices, folded, notExecuted.has(i), y);
        // IF / NOTIF / ELSE / ENDIF sit at the outer level, the ops between them one level in.
        // A fold is a whole dead branch, so its nested IFs and ENDIFs balance out inside it
        const code = folded ? null : op.code;
        let level = depth;
        if (code === 0x67) {
          level = Math.max(0, depth - 1);
        } else if (code === 0x68) {
          depth = Math.max(0, depth - 1);
          level = depth;
        }
        block.x += level * INDENT;
        if (code === 0x63 || code === 0x64) {
          depth++;
          openIfs.push(block);
        } else if (code === 0x68 && openIfs.length) {
          const ifBlock = openIfs.pop();
          this.guides.push({ x: ifBlock.x + 8, y1: ifBlock.y + this.blockH, y2: block.y });
        }
        if (op.inner) {
          y += INNER_LABEL_GAP + INNER_PAD;
          block.x += INNER_PAD;
          block.y = y;
          this.boxes.push({ x: block.x - INNER_PAD, y: y - INNER_PAD, width: block.width + 2 * INNER_PAD, height: this.blockH + 2 * INNER_PAD,
            label: this.sectionLabels[op.inner], inner: true });
          y += INNER_PAD + INNER_GAP;
        }
        this.blocks.push(block);
        indices.forEach(index => this.blockByOp.set(index, block));
        // the "not executed" label to the right of a block stays inside the section box
        boxRight = Math.max(boxRight, block.x + block.width + (op.inner ? INNER_PAD : 0));
        y += this.blockH;
        i += indices.length;
      }
      y += BOX_PAD;
      box.width = boxRight + BOX_PAD - box.x;
      box.height = y - box.y;
      maxRight = Math.max(maxRight, box.x + box.width);
      y += BOX_GAP;
    }
    // an empty redeem script has no blocks, but its handover still happens: show the chip and an empty box
    if (this.program.emptyRedeem && handovers) {
      addChip(y, this.handoverLabels.p2sh, 'handover');
      y += CHIP_H + BOX_GAP;
      const label = $localize`:@@script-debugger.section.redeemscript-empty:Redeem script (empty)`;
      const width = label.length * LABEL_CHAR_W + 40;
      this.boxes.push({ x: PAD, y, width, height: 2 * BOX_PAD, label });
      maxRight = Math.max(maxRight, PAD + width);
      y += 2 * BOX_PAD + BOX_GAP;
    }
    const last = steps[steps.length - 1];
    if (last?.opIndex === null && last.result) {
      addChip(y, last.result === 'valid' ? this.endLabels.valid : this.endLabels.invalid, last.result);
      y += CHIP_H + BOX_GAP;
    }
    this.chips.forEach(chip => maxRight = Math.max(maxRight, chip.x + chip.width));
    this.svgWidth = maxRight + PAD;
    this.svgHeight = y - BOX_GAP + PAD;
    this.updateWindow();
  }

  // pick the blocks, boxes and guides within RENDER_MARGIN of the script pane's visible part; true when that changed
  private updateWindow(): boolean {
    const pane = this.scriptPane?.nativeElement;
    const top = (pane?.scrollTop ?? 0) - RENDER_MARGIN;
    const bottom = (pane?.scrollTop ?? 0) + (pane?.clientHeight || 400) + RENDER_MARGIN;
    // blocks are laid out top to bottom, so binary search for the first one reaching into the window
    let lo = 0;
    let hi = this.blocks.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.blocks[mid].y + this.blockH < top) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    let end = lo;
    while (end < this.blocks.length && this.blocks[end].y <= bottom) {
      end++;
    }
    if (this.visibleBlocks[0] !== this.blocks[lo] || this.visibleBlocks.length !== end - lo || !this.visibleBlocks.length) {
      this.visibleBlocks = this.blocks.slice(lo, end);
      this.visibleBoxes = this.boxes.filter(box => box.y <= bottom && box.y + box.height >= top);
      this.visibleGuides = this.guides.filter(guide => guide.y1 <= bottom && guide.y2 >= top);
      this.cd.markForCheck();
      return true;
    }
    return false;
  }

  private makeBlock(op: ScriptOp, ops: number[], folded: boolean, notExecuted: boolean, y: number): Block {
    let hex = op.code === null ? '' : op.code.toString(16).padStart(2, '0');
    let name: string;
    if (folded) {
      hex = '…';
      name = $localize`:@@script-debugger.folded-block:${ops.length}:count: ops`;
    } else if (op.code === null) {
      name = op.label || (op.data ? $localize`:@@script-debugger.bytes:${op.data.length / 2}:count: bytes` : $localize`:@@script-debugger.empty:empty`);
    } else {
      name = op.name.replace(/^OP_/, '');
    }
    const category = op.code === null ? 'push' : OPCODES[op.code].category;
    const hexW = op.code === null && !folded ? 0 : this.hexW;
    return { ops, x: PAD + BOX_PAD, y, width: hexW + this.textWidth(name) + 20, hexW, hex, name, category, notExecuted };
  }

  // centre the tooltip on its block (but never past the top or bottom of the content) once its new content is rendered, so it doesn't jump,
  // and put it just right of the blocks and chips its height overlaps (covering a dashed box border is fine), not the widest part of the whole script
  ngAfterViewChecked(): void {
    const tooltip = this.tooltipEl?.nativeElement;
    const anchor = this.anchor;
    if (tooltip && anchor) {
      const bottom = Math.max(this.svgHeight, this.scriptPane?.nativeElement.clientHeight ?? 0) - 8;
      const top = Math.max(8, Math.min(anchor.y + anchor.h / 2 - tooltip.offsetHeight / 2, bottom - tooltip.offsetHeight));
      const end = top + tooltip.offsetHeight;
      let right = anchor.x;
      for (const block of this.visibleBlocks) {
        if (block.y < end && block.y + this.blockH > top) {
          right = Math.max(right, block.x + block.width);
        }
      }
      for (const chip of this.chips) {
        if (chip.y < end && chip.y + CHIP_H > top) {
          right = Math.max(right, chip.x + chip.width);
        }
      }
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${right + 28}px`;
    }
  }

  private scrollToCurrent(): void {
    if (this.stackScroll) {
      this.stackScroll.nativeElement.scrollTop = 0; // keep the top of the stack in view
    }
    const pane = this.scriptPane?.nativeElement;
    const anchor = this.anchor;
    if (pane && anchor && pane.scrollHeight > pane.clientHeight) {
      pane.scrollTo({ top: Math.max(0, anchor.y + anchor.h / 2 - pane.clientHeight / 2), behavior: scrollBehavior(this.animate && !this.rapid) });
    }
    this.updateScrollState();
  }

  trackByIndex(index: number): number {
    return index;
  }

  // by first op, not position: the drawn window slides, so positions shift
  trackByBlock(_: number, block: Block): number {
    return block.ops[0];
  }

  // removed items (fading out): new elements on every step, so their exit animation plays again
  trackByStep = (index: number): string => `${this.index}:${index}`;

  // the rest of the stack: an element is kept while its item doesn't change, and a changed item gets a new one (its enter animation plays)
  trackByItem(_: number, item: StackItem): string {
    return item.k;
  }
}
