/***************************************************************************************************
 * Load `$localize` onto the global scope - used if i18n tags appear in Angular templates.
*/

import * as domino from 'domino';

const win = domino.createWindow();
// @ts-ignore
global['window'] = win;
global['document'] = win.document;

import '@angular/localize/init';

import { enableProdMode } from '@angular/core';

import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

export { AppServerModule } from './app/app.server.module';
export { renderModule, renderModuleFactory } from '@angular/platform-server';
