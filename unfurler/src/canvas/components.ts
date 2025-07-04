import { fetchText } from "../api/api";
import config from "../config";
import { BlockExtended, BlockSummary } from "../api/mempool-api.interfaces";
import { IEsploraApi } from "../api/esplora-api.interface";
import { fetchJSON } from "../api/api";
import { getImage } from "./images";
import { renderBlockViz } from "./block-viz/block-viz";
import { themes } from "./themes";
import { CanvasRenderingContext2D } from 'canvas';

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
      ctx.font = 'bold 38.4px Segoe UI,Roboto';
      ctx.fillStyle = themes.default.fg;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);

      const logo = await getImage('mempool-logo');
      if (logo) {
        const maxHeight = 60;
        const scale = maxHeight / logo.height;
        const logoWidth = logo.width * scale;
        const logoHeight = logo.height * scale;

        const logoX = bounds.x + 20;
        const logoY = bounds.y + (bounds.h - logoHeight) / 2;
        
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      }
    }
  }),
  
  blockContent: (id: string, position: Position): Component => {
    const bounds = { ...position, w: position.w ?? 1200, h: position.h ?? 520 }
    return {
      type: 'block',
      data: [
        dataRequirements.blockHash(id),
        dataRequirements.extendedBlock(id),
      ],
      children: [
        components.blockViz(id, { x: bounds.x + bounds.w - 48 - 480, y: bounds.y + bounds.h - 16 - 480, w: 480, h: 480 }),
      ],
      render: async (ctx: CanvasRenderingContext2D, data: any, props: any = {}): Promise<void> => {
        // not yet implemented
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
  })
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
  })
};