import { BlockSummary } from "../../api/mempool-api.interfaces";
import BlockScene from "./block-scene";
import { Rect } from "../components";
import { themes } from "../themes";
import { CanvasRenderingContext2D } from 'canvas';


export async function renderBlockViz(ctx: CanvasRenderingContext2D, summary: BlockSummary, bounds: Rect, theme: string, highlightingEnabled: boolean) {
  const blockScene = new BlockScene({
    width: bounds.w,
    height: bounds.h,
    resolution: 86,
    blockLimit: 1_000_000,
    orientation: 'bottom',
    flip: false,
    theme,
    colorFunction: null,
    highlightingEnabled,
  });

  blockScene.setup(summary);

  // fill bounds with background color 
  ctx.fillStyle = themes[theme].box;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);

  // render each transaction in the scene in the appropriate positino & color
  for (const tx of summary) {
    const txView = blockScene.txs[tx.txid];
    if (txView) {
      const color = blockScene.getColor(txView);
      ctx.fillStyle = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${color.a})`;
      // these rectangles need to be clipped to the bounds
      const x1 = Math.max(bounds.x, bounds.x + txView.screenPosition.x);
      const y1 = Math.max(bounds.y, bounds.y + txView.screenPosition.y);
      const x2 = Math.min(bounds.x + bounds.w, bounds.x + txView.screenPosition.x + txView.screenPosition.s);
      const y2 = Math.min(bounds.y + bounds.h, bounds.y + txView.screenPosition.y + txView.screenPosition.s);

      if (x1 < x2 && y1 < y2) {
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      }
    }
  }
}