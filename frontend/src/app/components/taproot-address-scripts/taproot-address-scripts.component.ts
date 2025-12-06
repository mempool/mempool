import { Component, ChangeDetectionStrategy, Input, OnChanges, NgZone, Output, SimpleChanges, ChangeDetectorRef, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { EChartsOption } from '@app/graphs/echarts';
import { ScriptInfo } from '@app/shared/script.utils';
import { computeLeafHash, taggedHash, taprootAddressToOutputKey } from '@app/shared/transaction.utils';
import { StateService } from '@app/services/state.service';
import { AsmStylerPipe } from '@app/shared/pipes/asm-styler/asm-styler.pipe';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

interface TaprootTree {
  name: string; // the TapBranch hash or TapLeaf script hash
  value?: LeafNode;
  special?: 'internalKey' | 'merkleRoot';
  depth?: number;
  children?: [TaprootTree, TaprootTree];
  // ECharts properties
  symbol?: string;
  symbolSize?: number;
  symbolOffset?: number[];
  label?: any;
  tooltip?: { label: string, content?: string }[];
}

interface LeafNode {
  leafVersion: number;
  script: ScriptInfo;
  merklePath: string[];
}

@Component({
  selector: 'app-taproot-address-scripts',
  templateUrl: './taproot-address-scripts.component.html',
  styleUrls: ['./taproot-address-scripts.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaprootAddressScriptsComponent implements OnChanges {
  @Input() address: string;
  @Input() scripts: Map<string, ScriptInfo>;
  @Output() tapTreeIncomplete = new EventEmitter<boolean>(true);

  tree: TaprootTree;
  croppedTree: TaprootTree;
  croppedTreeDepth: number = 7;
  depth: number = 0;
  depthShown: number;
  height: number;
  levelHeight: number = 40;
  fullTreeShown: boolean;
  maybetapTreeIncomplete: boolean = false;
  isNUMS: boolean = false;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  chartInstance: any;
  isTouchscreen: boolean = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0;

  constructor(
    public stateService: StateService,
    private asmStylerPipe: AsmStylerPipe,
    private cd: ChangeDetectorRef,
    private location: Location,
    private relativeUrlPipe: RelativeUrlPipe,
    private router: Router,
    private zone: NgZone,
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.scripts?.currentValue && changes.scripts.currentValue.size) {
      this.buildTree(Array.from(this.scripts.values()));
      this.prepareTree(this.tree, 0);
      this.tapTreeIncomplete.emit(this.maybetapTreeIncomplete);
      this.cropTree();
      this.toggleTree(this.fullTreeShown, false);
    }
  }

  buildTree(scripts: ScriptInfo[]): void {
    this.depth = 0;
    this.maybetapTreeIncomplete = false;

    // treeStructure is a list of maps, where each map contains as keys the hashes of the nodes at that depth, and as values the hashes of its two children
    const treeStructure: Map<string, [string, string]>[] = [];
    const leaves = new Map<string, LeafNode>();
    const ensureLevels = (levels: number) => {
      while (treeStructure.length < levels) {
        treeStructure.push(new Map<string, [string, string]>());
      }
    };

    for (const script of scripts) {
      const leafVersion = script.taprootInfo.scriptPath.leafVersion;
      const merklePath = script.taprootInfo.scriptPath.merkleBranches.slice();
      this.depth = Math.max(this.depth, merklePath.length);
      ensureLevels(merklePath.length);
      const tapLeaf = computeLeafHash(script.hex, leafVersion);
      leaves.set(tapLeaf, { leafVersion, script, merklePath });
      let k = tapLeaf;
      for (let j = 0; j < merklePath.length; j++) {
        const e = merklePath[j];
        const firstChild = k < e ? k : e;
        const secondChild = firstChild === k ? e : k;
        const parentHash = taggedHash('TapBranch', firstChild + secondChild);
        const previousLevelIndex = merklePath.length - j - 1;
        const level = treeStructure[previousLevelIndex];
        if (level.has(parentHash)) {
          break;
        }
        level.set(parentHash, [firstChild, secondChild]);
        k = parentHash;
      }
    }

    // Expand the tree to include public key, internal key and merkle root
    const internalKeyNode = scripts[0].taprootInfo.scriptPath.internalKey;
    const merkleRootNode = treeStructure.length > 0 ? treeStructure[0].keys().next().value : leaves.keys().next().value;
    const outputKeyNode = taprootAddressToOutputKey(this.address).outputKey;
    treeStructure.unshift(new Map<string, [string, string]>());
    treeStructure[0].set(outputKeyNode, [internalKeyNode, merkleRootNode]);
    this.depth++;
    this.isNUMS = scripts[0].taprootInfo.scriptPath.isNUMS;

    // Build the tree recursively
    const recursiveBuild = (hash: string, depth: number, special?: TaprootTree['special']): TaprootTree => {
      const node: TaprootTree = {
        name: hash,
        depth: depth
      };

      if (special) {
        node.special = special;
      }

      if (leaves.has(hash)) {
        node.value = leaves.get(hash);
        return node;
      }

      if (depth < treeStructure.length && treeStructure[depth].has(hash)) {
        const [firstChild, secondChild] = treeStructure[depth].get(hash);
        node.children = [
          recursiveBuild(firstChild, depth + 1, depth === 0 ? 'internalKey' : undefined),
          recursiveBuild(secondChild, depth + 1, depth === 0 ? 'merkleRoot' : undefined)
        ];
      }

      return node;
    };
    const root = treeStructure[0].keys().next().value;
    this.tree = recursiveBuild(root, 0);
  }

  cropTree(): void {
    const cropNode = (node: TaprootTree, currentDepth: number) => {
      if (!node) {
        return;
      }
      if (currentDepth === this.croppedTreeDepth && node.children) {
        delete node.children;
        return;
      }
      if (node.children) {
        cropNode(node.children[0], currentDepth + 1);
        cropNode(node.children[1], currentDepth + 1);
      }
    };
    this.croppedTree = JSON.parse(JSON.stringify(this.tree));
    cropNode(this.croppedTree, 0);
  }

  toggleTree(show: boolean, delay = true): void {
    this.fullTreeShown = show;
    this.depthShown = show ? this.depth : Math.min(this.depth, this.croppedTreeDepth);
    if (show) {
      this.height = (this.depthShown + 1) * this.levelHeight;
      setTimeout(() => {
        this.prepareChartOptions(this.tree);
        this.cd.markForCheck();
      }, 115);
    } else {
      this.prepareChartOptions(this.croppedTree);
      if (!delay) {
        this.height = (this.depthShown + 1) * this.levelHeight;
      } else {
        setTimeout(() => {
          this.height = (this.depthShown + 1) * this.levelHeight;
          this.cd.markForCheck();
        }, 200);
      }
    }
  }


  prepareTree(node: TaprootTree, depth: number): void {
    if (!node) {
      return;
    }

    node.depth = depth;
    node.symbol = 'none';

    const basePillStyle = {
      align: 'center',
      padding: [3, 6],
      borderRadius: 10,
      fontSize: 10,
      fontWeight: 'bold',
      fontFamily: 'system-ui',
    };

    if (depth === 0) {
      node.symbol = 'none';
      node.label = {
        formatter: '{pill|Public Key}',
        offset: [0, -5],
        rich: {
          pill: {
            ...basePillStyle,
            backgroundColor: 'var(--primary)',
            color: '#fff',
          },
        },
      };
      node.tooltip = [
        { label: 'Public Key', content: node.name.slice(0, 10) + '…' + node.name.slice(-10) },
      ];
    }

    if (node.children) {
      if (depth > 0) {
        if (!node.special) {
          node.symbol = 'circle';
          node.symbolSize = 10;
          node.symbolOffset = [0, 5];
          node.label = { formatter: '' };
          node.tooltip = [
            { label: 'TapBranch Hash', content: node.name.slice(0, 10) + '…' + node.name.slice(-10) },
            { label: 'Depth', content: (depth - 1).toString() },
          ];
        } else if (node.special === 'merkleRoot') {
          node.label = {
            formatter: '{pill|Taproot}',
            offset: [0, -5],
            rich: {
              pill: {
                ...basePillStyle,
                backgroundColor: 'var(--tertiary)',
                color: '#fff',
              },
            },
          };
          node.tooltip = [
            { label: 'Merkle Root', content: node.name.slice(0, 10) + '…' + node.name.slice(-10) },
          ];
        }
      }
      this.prepareTree(node.children[0], depth + 1);
      this.prepareTree(node.children[1], depth + 1);
    } else {
      if (node.value) {
        const script = node.value.script;
        const label = script.template?.label;

        node.label = {
          formatter: `{pill|${label || 'Script'}}`,
          offset: [0, 5],
          verticalAlign: 'middle',
          rich: {
            pill: {
              ...basePillStyle,
              backgroundColor: '#ffc107',
              color: '#212529'
            }
          }
        };

        node.tooltip = [
          { label: 'TapLeaf Hash', content: node.name.slice(0, 10) + '…' + node.name.slice(-10) },
          { label: 'Depth', content: (depth - 1).toString() },
          { label: 'Leaf Version', content: node.value.leafVersion.toString(16) },
        ];

      } else if (node.special === 'internalKey') {
        const internalKeyLabel = this.isNUMS ? 'Internal Key 🚫' : 'Internal Key';
        node.label = {
          formatter: `{pill|${internalKeyLabel}}`,
          offset: [0, -5],
          rich: {
            pill: {
              ...basePillStyle,
              backgroundColor: this.isNUMS ? 'var(--grey)' : 'var(--tertiary)',
              color: '#fff',
            },
          },
        };
        node.tooltip = [
          { label: 'Internal Key', content: node.name.slice(0, 10) + '…' + node.name.slice(-10) },
        ];
      } else {
        node.symbol = 'circle';
        node.symbolSize = 10;
        node.symbolOffset = [0, 5];
        node.label = { formatter: '' };
        node.tooltip = [
          { label: 'Hash', content: node.name.slice(0, 10) + '…' + node.name.slice(-10) },
          { label: 'Depth', content: (depth - 1).toString() },
        ];
        this.maybetapTreeIncomplete = true;
      }
    }
  }

  prepareChartOptions(tree: TaprootTree) {
    if (!tree) {
      return;
    }

    this.chartOptions = {
      tooltip: {
        show: true,
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        confine: true,
        textStyle: {
          color: '#b1b1b1',
        },
        borderColor: '#000',
        formatter: (params: any) => {
          const node: TaprootTree = params.data;
          if (!node.tooltip) {
            return '';
          }

          let rows = node.tooltip.map(
            (item) =>
              `<tr>
                  <td style="color: #fff; padding-right: 5px; width: 30%">${item.label}</td>
                  <td style="color: ${item.label === 'Internal Key' && this.isNUMS ? '#ffdddd' : '#b1b1b1'}; text-align: right">${item.content}</td>
                </tr>`
          ).join('');

          if (node.value?.script.vinId) {
            const [txid, vinIndex] = node.value.script.vinId.split(':');
            rows += `
              <tr>
                <td style="color: #fff; padding-right: 5px; width: 30%">Last used in tx</td>
                <td style="color: #b1b1b1; text-align: right">
                  <a href="${this.relativeUrlPipe.transform('/tx/' + txid)}?mode=details#vin=${vinIndex}">${txid.slice(0, 10) + '…' + txid.slice(-10)}</a>
                </td>
              </tr>`;
          }

          let asmContent = '';
          if (node.value?.script?.asm) {
            const asm = this.asmStylerPipe.transform(node.value.script.asm, 300);
            asmContent = `
              <div style="margin-top: 10px; border-top: 1px solid #333; padding-top: 5px; word-break: break-all; white-space: normal; font-family: monospace; font-size: 12px;">
                <td>${asm} ${node.value.script.asm.length > 300 ? '...' : ''}</td>
              </div>`;
          } else if (node.value?.script?.type === 'inner_simplicityscript') {
            const hex = node.value.script.hex.slice(0, 300);
            asmContent = `
              <div style="margin-top: 10px; border-top: 1px solid #333; padding-top: 5px; word-break: break-all; white-space: normal; font-family: monospace; font-size: 12px;">
                <td>Simplicity script: ${hex} ${node.value.script.hex.length > 300 ? '...' : ''}</td>
              </div>`;
          }

          let hiddenScriptsMessage = '';
          if (node.tooltip[0].label === 'Hash') {
            const remaining = 128 - (node.depth - 1);
            let upperBoundHtml: string;
            if (remaining === 0) {
              upperBoundHtml = '1';
            } else if (remaining <= 39) {
              upperBoundHtml = (2 ** remaining).toLocaleString();
            } else {
              upperBoundHtml = `2<sup style="font-size: 0.85em;">${remaining}</sup>`;
            }
            hiddenScriptsMessage = `
              <div style="margin-top: 8px; color: #888; font-size: 11px; line-height: 1.3; font-style: italic; border-top: 1px solid #333; padding-top: 6px; word-break: break-word; white-space: normal">
                This node might commit to ${upperBoundHtml === '1' ? 'exactly 1 script' : `at most ${upperBoundHtml} scripts`}.
              </div>`;
          }

          return `
            <div style="max-width: 300px; pointer-events: auto;"">
              <table style="width: 100%; table-layout: fixed;">
                <tbody>${rows}</tbody>
              </table>
              ${asmContent}
              ${hiddenScriptsMessage}
            </div>`;
        },
      },
      series: [{
        type: 'tree',
        data: [tree as any],
        top: '20',
        bottom: '20',
        right: 0,
        left: 0,
        height: Math.max(140, this.depthShown * this.levelHeight),
        lineStyle: {
          curveness: 0.9,
          width: 2,
        },
        emphasis: {
          focus: 'ancestor',
          itemStyle: {
            color: '#ccc',
          },
          lineStyle: {
            color: '#ccc',
          }
        },
        orient: 'TB',
        expandAndCollapse: false,
        animationDuration: 250,
        animationDurationUpdate: 250,
      }],
    };
  }

  onChartInit(ec) {
    this.chartInstance = ec;
    this.chartInstance.on('click', 'series', this.onChartClick.bind(this));
  }

  onChartClick(e): void {
    if (this.isTouchscreen) { // show tooltip on touchscreen, and click on link in tooltip to navigate
      return;
    }

    if (!e.data.value?.script.vinId) {
      return;
    }

    const [txid, vinIndex] = e.data.value.script.vinId.split(':');
    const url = this.router.createUrlTree([this.relativeUrlPipe.transform('/tx'), txid], { fragment: 'vin=' + vinIndex });

    this.zone.run(() => {
      if (e.event?.event?.ctrlKey || e.event?.event?.metaKey) {
        const fullUrl = this.location.prepareExternalUrl(this.router.serializeUrl(url));
        window.open(fullUrl, '_blank');
      } else {
        this.router.navigate([this.relativeUrlPipe.transform('/tx'), txid], { fragment: 'vin=' + vinIndex });
      }
    });

  }
}
