export interface SeoRenderer {
  init(host: string): Promise<void>;
  stop(): Promise<void>;
  render(path: string, reqUrl: string): Promise<string | undefined>;
}