import { Match } from './routes';

export interface Renderer {
  init(host: string): Promise<void>;
  stop(): Promise<void>;
  render(path: string, reqUrl: string, matchedRoute: Match): Promise<Uint8Array | undefined>;
}