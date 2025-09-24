import { fetchText } from "../api/api";
import config from "../config";
import { BlockExtended, BlockSummary } from "../api/mempool-api.interfaces";
import { IEsploraApi } from "../api/esplora-api.interface";
import { fetchJSON } from "../api/api";
import { getImage } from "./images";
import { renderBlockViz } from "./block-viz/block-viz";
import { themes } from "./themes";
import { CanvasRenderingContext2D, Image } from 'canvas';
import { formatNumber, formatWeightUnit, middleEllipsis, renderQrToCtx } from "./utils/utils";
import { Hash } from './utils/sha256';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Position {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface Component {
  type: string;
  data?: DataRequirement<any>[];
  children?: Component[];
  props?: Record<string, any> | ((data: any, props: any) => Record<string, any>);
  render?: (ctx: CanvasRenderingContext2D, data: any, props?: any) => Promise<void>;
}

// Data Requirements Library
async function getBlockHash(id: string): Promise<string> {
  if (id.length === 64) {
    return id;
  }
  const height = parseInt(id) || 0;
  return await fetchText(config.API.ESPLORA + `/block-height/${height}`) as string;
}

export interface DataRequirement<V> {
  key: string;
  fetcher: () => Promise<V>;
}

// Data Requirements
export const dataRequirements: Record<string, (id: string) => DataRequirement<any>> = {
  blockHash: (id: string): DataRequirement<string> => ({
    key: `block_hash_${id}`,
    fetcher: async () => await getBlockHash(id)
  }),
  
  block: (id: string): DataRequirement<IEsploraApi.Block> => ({
    key: `block_${id}`,
    fetcher: async () => {
      const hash = await getBlockHash(id);
      return await fetchJSON(config.API.ESPLORA + `/block/${hash}`) as IEsploraApi.Block;
    }
  }),
  
  extendedBlock: (id: string): DataRequirement<BlockExtended> => ({
    key: `extended_block_${id}`,
    fetcher: async () => {
      const hash = await getBlockHash(id);
      return await fetchJSON(config.API.MEMPOOL + `/block/${hash}`) as BlockExtended;
    }
  }),
  
  blockSummary: (id: string): DataRequirement<BlockSummary> => ({
    key: `block_summary_${id}`,
    fetcher: async () => {
      const hash = await getBlockHash(id);
      return await fetchJSON(config.API.MEMPOOL + `/block/${hash}/summary`) as BlockSummary;
    }
  }),

  address: (addressString: string): DataRequirement<IEsploraApi.Address> => ({
    key: `address_${addressString}`,
    fetcher: async () => {
      if (addressString.match(/04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}/)) {
        const scriptpubkey: string = (addressString.length === 130 ? '41' : '21') + addressString + 'ac';
        const matchResult = scriptpubkey.match(/.{2}/g);
        let scriptHash = '';
        if (matchResult) {
          const buf = Uint8Array.from(matchResult.map((byte) => parseInt(byte, 16)));
          const hash = new Hash().update(buf).digest();
          const hashArray = Array.from(new Uint8Array(hash));
          scriptHash = hashArray.map((bytes) => bytes.toString(16).padStart(2, '0')).join('');
        }
        return await fetchJSON(config.API.ESPLORA + `/scripthash/${scriptHash}`) as IEsploraApi.Address;
      } else {
        return await fetchJSON(config.API.ESPLORA + `/address/${addressString}`) as IEsploraApi.Address;
      }
    }
  })
};

// Components
export const components: Record<string, (...args: any[]) => Component> = {
  background: (position: Position): Component => ({
    type: 'background',
    data: [],
    render: async (ctx: CanvasRenderingContext2D, data: any, props: any = {}): Promise<void> => {
      const bounds = { ...position, w: 1200, h: 600 };
      ctx.fillStyle = themes.default.background;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    }
  }),
  
  header: (title: string, position: Position): Component => ({
    type: 'header',
    data: [],
    render: async (ctx: CanvasRenderingContext2D, data: any, props: any = {}): Promise<void> => {
      const bounds = { ...position, w: 1200, h: 80 };
      ctx.fillStyle = themes.default.header;
      ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
      ctx.font = 'bold 38.4px Roboto';
      ctx.fillStyle = themes.default.fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const networkName = props.networkName; // bitcoin, liquid, onbtc...
      if (networkName !== 'liquid') {
        title = `Bitcoin ${title}`;
      }

      ctx.fillText(title, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);

      const mempoolLogo = await getImage('mempool-logo');
      if (mempoolLogo) {
        const maxHeight = 50;
        const scale = maxHeight / mempoolLogo.height;
        const logoWidth = mempoolLogo.width * scale;
        const logoHeight = mempoolLogo.height * scale;

        const logoX = bounds.x + 49;
        const logoY = bounds.y + (bounds.h - logoHeight) / 2;
        
        ctx.drawImage(mempoolLogo, logoX, logoY, logoWidth, logoHeight);
      }

      const networkMode = props.networkMode; // mainnet, testnet4, ...
      const networkLogo = await getImage(`${networkName}-${networkMode}-logo`);

      const capitalizedNetworkMode = networkMode.charAt(0).toUpperCase() + networkMode.slice(1);
      ctx.font = 'bold 26px Roboto';
      const textWidth = ctx.measureText(capitalizedNetworkMode).width;
      const spacing = 8;
      const rightMargin = 48;

      if (networkLogo) {
        const maxHeight = 35;
        const scale = maxHeight / networkLogo.height;
        const logoWidth = networkLogo.width * scale;
        const logoHeight = networkLogo.height * scale;
        const logoX = bounds.w - logoWidth - textWidth - spacing - rightMargin;
        const logoY = bounds.y + (bounds.h - logoHeight) / 2;
        ctx.drawImage(networkLogo, logoX, logoY, logoWidth, logoHeight);

        ctx.fillStyle = themes.default.fg;
        ctx.textAlign = 'left';
        const textX = logoX + logoWidth + spacing;
        const textY = bounds.y + bounds.h / 2;
        ctx.fillText(capitalizedNetworkMode, textX, textY);
      }
    }
  }),

  addressContent: (id: string, position: Position): Component => {
    const bounds = { ...position, w: position.w ?? 1200, h: position.h ?? 520 }
    return {
      type: 'address',
      data: [
        dataRequirements.address(id),
      ],
      props: (data) => {
        const a = data[`address_${id}`];
        const received = a.chain_stats.funded_txo_sum / 1e8;
        const sent = a.chain_stats.spent_txo_sum / 1e8;
        const rows = [
          { label: 'Total received', value: { num: formatNumber(received, '1.8-8'), unit: 'BTC' } },
          { label: 'Total sent', value: { num: formatNumber(sent, '1.8-8'), unit: 'BTC' } },
          { label: 'Balance', value: { num: formatNumber(received - sent, '1.8-8'), unit: 'BTC' } },
          { label: 'Transactions', value: formatNumber(a.chain_stats.tx_count + a.mempool_stats.tx_count, '1.0-0') },
          { label: 'Unspent TXOs', value: formatNumber(a.chain_stats.funded_txo_count - a.chain_stats.spent_txo_count, '1.0-0') },
        ];
        return { tableRows: rows };
      },
      children: [
        components.qrcode(id, { x: bounds.x + bounds.w - 48 - 480, y: bounds.y + bounds.h - 16 - 480, w: 480, h: 480 }),
        components.table({ x: bounds.x + 48, y: bounds.y + 129 }),
      ],
      render: async (ctx: CanvasRenderingContext2D, data: any, props: any = {}): Promise<void> => {
        const address: string = id;

        ctx.font = 'bold 50px Roboto';
        ctx.fillStyle = themes.default.fg;
        ctx.textAlign = 'left';

        const availableWidth = bounds.w - 96 - 480;
        ctx.fillText(middleEllipsis(ctx, address, availableWidth), bounds.x + 48, bounds.y + 60);
      }
    }
  },
  
  blockContent: (id: string, position: Position): Component => {
    const bounds = { ...position, w: position.w ?? 1200, h: position.h ?? 520 }
    return {
      type: 'block',
      data: [
        dataRequirements.blockHash(id),
        dataRequirements.extendedBlock(id),
      ],
      props: (data) => {
        const blockData = data[`extended_block_${id}`];
        const rows = [
          { label: 'Timestamp', value: new Date(blockData.timestamp * 1000).toLocaleString('sv-SE').replace(',', '').slice(0, 16) },
          { label: 'Weight', value: formatWeightUnit(blockData.weight, 2) },
          { label: 'Median fee', value: { num: '~' + formatNumber(blockData.extras.medianFee, '1.0-0'), unit: 'sat/vB' } },
          { label: 'Total fees', value: { num: formatNumber(blockData.extras.totalFees / 100000000, '1.2-3'), unit: 'BTC' } },
          { label: 'Miner', value: blockData.extras.pool }
        ];
        return { tableRows: rows };
      },
      children: [
        components.blockViz(id, { x: bounds.x + bounds.w - 48 - 480, y: bounds.y + bounds.h - 16 - 480, w: 480, h: 480 }),
        components.table({ x: bounds.x + 48, y: bounds.y + 129 })
      ],
      render: async (ctx: CanvasRenderingContext2D, data: any, props: any = {}): Promise<void> => {
        const blockData = data[`extended_block_${id}`];

        const blockHeight = blockData.height.toString()
        ctx.font = 'bold 66px Roboto';
        ctx.fillStyle = themes.default.fg;
        ctx.textAlign = 'left';
        const blockNumberWidth = ctx.measureText(blockHeight).width;
        ctx.fillText(blockHeight, bounds.x + 48, bounds.y + 60);

        ctx.font = '32px Courier New,Roboto';
        ctx.fillStyle = themes.default.fg;
        const charWidth = ctx.measureText('A').width;
        const availableHashWidth = bounds.w - 96 - blockNumberWidth - 34 - 480 - 10;
        const maxChars = Math.floor(availableHashWidth / charWidth) - 1;
        const hashFirstHalf = blockData.id.slice(0, maxChars) + '…';
        const hashSecondHalf = '…' + blockData.id.slice(-maxChars);
        ctx.fillText(hashFirstHalf, bounds.x + 48 + blockNumberWidth + 32, bounds.y + 38);
        ctx.fillText(hashSecondHalf, bounds.x + 48 + blockNumberWidth + 32, bounds.y + 73);
      }
    }
  },
  
  blockViz: (id: string, position: Position): Component => ({
    type: 'block-viz',
    data: [
      dataRequirements.blockHash(id),
      dataRequirements.blockSummary(id),
    ],
    render: async (ctx: CanvasRenderingContext2D, data: any, props: any = {}): Promise<void> => {
      const bounds = { ...position, w: position.w ?? 480, h: position.h ?? 480 } as Rect;
      const summary = data['block_summary_' + id];
      return renderBlockViz(ctx, summary, bounds, 'default', false);
    }
  }),

  table: (position: Position): Component => ({
    type: 'table',
    data: [],
    render: async (ctx: CanvasRenderingContext2D, data: any, props: any = {}): Promise<void> => {
      const rows = props.tableRows ?? [];

      // Build the table
      let yOffset = position.y;
      const rowHeight = 75;
      const rowWidth = 610;
      const labelPadding = 15;
      const valuePadding = 50;

      // measure all label widths to find the maximum
      ctx.font = '32px Roboto';
      let maxLabelWidth = 0;
      for (const row of rows) {
        const labelWidth = ctx.measureText(row.label).width;
        maxLabelWidth = Math.max(maxLabelWidth, labelWidth);
      }
      const valueXPosition = position.x + labelPadding + maxLabelWidth + valuePadding;

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];

        if (index % 2 === 0) {
          ctx.fillStyle = themes.default.box;
          ctx.fillRect(position.x, yOffset, rowWidth, rowHeight);
        }

        // label
        ctx.font = '32px Roboto';
        ctx.fillStyle = themes.default.fg;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(row.label, position.x + labelPadding, yOffset + rowHeight / 2);

        // value based on type: string, { num: number, unit: string }, or pool data
        if (typeof (row.value) === 'string') {
          ctx.font = '32px Roboto';
          ctx.textAlign = 'left';
          ctx.fillText(row.value, valueXPosition, yOffset + rowHeight / 2);
        } else if (row.value.num && row.value.unit) {
          ctx.font = '32px Roboto';
          ctx.textAlign = 'left';
          ctx.fillStyle = themes.default.fg;
          ctx.fillText(row.value.num, valueXPosition, yOffset + rowHeight / 2);
          const numWidth = ctx.measureText(row.value.num).width;
          ctx.font = '24px Roboto';
          ctx.fillStyle = themes.default.symbol;
          ctx.fillText(row.value.unit, valueXPosition + numWidth + 6, yOffset + 2 + rowHeight / 2);
        } else if (row.value.slug) {
          let poolLogo: Image;
          try {
            poolLogo = await getImage(`mining-pool-${row.value.slug}`);
          } catch {
            poolLogo = await getImage('mining-pool-default');
          }
          if (poolLogo) {
            let leftSpacing = 0;
            if (row.value.minerNames?.length > 1 && row.value.minerNames[1] != '') {
              let minerName = '';
              if (row.value.minerNames[1].length > 16) {
                minerName = row.value.minerNames[1].slice(0, 15) + '…';
              } else {
                minerName = row.value.minerNames[1];
              }
              ctx.font = 'bold 26px Roboto';
              ctx.fillStyle = themes.default.fg;
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              leftSpacing = ctx.measureText(minerName).width + 6;
              ctx.fillText(minerName, valueXPosition, yOffset + rowHeight / 2);
            }
            const maxHeight = 26;
            const scale = maxHeight / poolLogo.height;
            const logoWidth = poolLogo.width * scale;
            const logoHeight = poolLogo.height * scale;
            ctx.font = 'bold 26px Roboto';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.drawImage(poolLogo, valueXPosition + leftSpacing, yOffset + rowHeight / 2 - logoHeight / 2, logoWidth, logoHeight);

            ctx.fillStyle = themes.default.fg;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(row.value.name, valueXPosition + leftSpacing + logoWidth + 6, yOffset + rowHeight / 2);
          }
        }

        yOffset += rowHeight;
      }
    }
  }),

  qrcode: (text: string, position: Position): Component => ({
    type: 'qrcode',
    data: [],
    render: async (ctx: CanvasRenderingContext2D) => {
      const bounds = { ...position, w: position.w ?? 480, h: position.h ?? 480 } as Rect;
      renderQrToCtx(ctx, text, bounds);
    }
  }),
};

// Views
export const views: Record<string, (...args: any[]) => Component> = {
  block: (hash: string): Component => ({
    type: 'block',
    data: [],
    children: [
      components.background({ x: 0, y: 0 }),
      components.header('Block', { x: 0, y: 0 }),
      components.blockContent(hash, { x: 0, y: 80, w: 1200, h: 520 })
    ]
  }),
  address: (address: string): Component => ({
    type: 'address',
    data: [],
    children: [
      components.background({ x: 0, y: 0 }),
      components.header('Address', { x: 0, y: 0 }),
      components.addressContent(address, { x: 0, y: 80, w: 1200, h: 520 })
    ]
  })
};