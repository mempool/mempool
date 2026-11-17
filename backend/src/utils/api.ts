import { NextFunction, Request, Response } from 'express';
import { STATUS_CODES } from 'http';
import logger from '../logger';

export function handleError(req: Request, res: Response, statusCode: number, errorMessage: string | unknown): void {
  if (req.accepts('json')) {
    res.status(statusCode).json({ error: errorMessage });
  } else {
    res.status(statusCode).send(errorMessage);
  }
}

export function apiErrorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    return next(err);
  }
  const status = err?.status >= 400 && err?.status < 500 ? err.status : 500;
  if (status === 500) {
    logger.err(`Unhandled error on ${req.method} ${req.path}: ${err?.stack ?? err}`);
  }
  handleError(req, res, status, STATUS_CODES[status]);
}
