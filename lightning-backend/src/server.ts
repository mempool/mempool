import { Express, Request, Response, NextFunction } from 'express';
import * as express from 'express';
import * as http from 'http';
import logger from './logger';
import config from './config';
import nodesRoutes from './api/nodes/nodes.routes';
import channelsRoutes from './api/nodes/channels.routes';

class Server {
  private server: http.Server | undefined;
  private app: Express = express();

  public startServer() {
    this.app
      .use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      })
      .use(express.urlencoded({ extended: true }))
      .use(express.text())
    ;

    this.server = http.createServer(this.app);

    this.server.listen(config.MEMPOOL.HTTP_PORT, () => {
      logger.notice(`Mempool Lightning is running on port ${config.MEMPOOL.HTTP_PORT}`);
    });

    this.initRoutes();
  }

  private initRoutes() {
    nodesRoutes.initRoutes(this.app);
    channelsRoutes.initRoutes(this.app);
  }
}

export default new Server();
