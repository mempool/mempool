// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// When a command from ./commands is ready to use, import with `import './commands'` syntax
import 'cypress-wait-until';
import './commands';
import failOnConsoleError from 'cypress-fail-on-console-error';

failOnConsoleError();

beforeEach(() => {
  cy.on('window:before:load', (win) => {
    const originalGet = win.URLSearchParams.prototype.get;
    win.URLSearchParams.prototype.get = function (name: string) {
      if (name === 'screenshot') {
        return 'true';
      }
      return originalGet.call(this, name);
    };
  });
});

afterEach(() => {
  cy.screenshot({
    capture: 'fullPage',
  });
});