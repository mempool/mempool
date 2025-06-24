export interface Renderer {
  init(host: string): Promise<void>;
  stop(): Promise<void>;
  render(path: string, reqUrl: string): Promise<Uint8Array | undefined>;
}