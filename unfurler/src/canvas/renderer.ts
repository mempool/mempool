import config from '../config';
import { Renderer } from '../renderer';
import logger from '../logger';
import { Match as RouteMatch } from '../routes';
import { createCanvas } from 'canvas';
import { Component, DataRequirement, views } from './components';

class CanvasRenderer implements Renderer {
  mempoolHost = '';
  network;
  networkName;
  
  async init(host: string, network?: string, networkName?: string): Promise<void> {
    this.mempoolHost = host;
    this.network = network || config.MEMPOOL.NETWORK || 'bitcoin';
    this.networkName = networkName || this.network;
  }

  async stop(): Promise<void> {
    // nothing to stop
  }

  async render(path: string, reqUrl: string, matchedRoute: RouteMatch): Promise<Uint8Array | undefined> {
    if (!matchedRoute.canvasView) {
      return undefined;
    }

    try {
      const viewFactory = views[matchedRoute.canvasView];
      if (!viewFactory) {
        throw new Error(`No view found for: ${matchedRoute.canvasView}`);
      }
      const view = viewFactory(...(matchedRoute.params || []));
      if (!view) {
        throw new Error(`No view found for: ${matchedRoute.canvasView}`);
      }

      const dataRequirements = this.collectDataRequirements(view);
      const data = await this.fetchData(dataRequirements);
      const png = await this.renderView(view, data, matchedRoute.params);
      return png;
    } catch (error: any) {
      logger.err(`Failed to render canvas for ${reqUrl}: ${error.message}`);
      return undefined;
    }
  }

  // traverse tree of view components gathering list of  required data
  // then deduplicate and return
  private collectDataRequirements(view: Component): DataRequirement<any>[] {
    const requirements: Record<string, DataRequirement<any>> = {};

    const stack: Component[] = [view];

    while (stack.length > 0) {
      const component = stack.pop();
      if (component?.data) {
        component.data.forEach(data => {
          requirements[data.key] = data;
        });
      }
      if (component?.children) {
        stack.push(...component.children);
      }
    }

    return Object.values(requirements);
  }

  private async fetchData(requirements: DataRequirement<any>[]): Promise<Record<string, any>> {
    const results: Record<string, any> = {};    
    const fetchTasks = requirements.map(async req => {
      const result = await req.fetcher();
      results[req.key] = result;
    });
    await Promise.all(fetchTasks);
    return results;
  }

  private async renderView(view: Component, data: Record<string, any>, params: any): Promise<Uint8Array> {
    const canvas = createCanvas(1200, 600);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const renderStack = [view];
    while (renderStack.length) {
      const next = renderStack.pop();
      if (next?.render) {
        await next.render(ctx, data, params);
      }
      if (next?.children) {
        renderStack.push(...[...next.children].reverse());
      }
    }
    return canvas.toBuffer('image/png');
  }
}

export default new CanvasRenderer();