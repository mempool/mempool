// ***********************************************
// This example namespace declaration will help
// with Intellisense and code completion in your
// IDE or Text Editor.
// ***********************************************
// declare namespace Cypress {
//   interface Chainable<Subject = any> {
//     customCommand(param: any): typeof customCommand;
//   }
// }
//
// function customCommand(param: any): void {
//   console.warn(param);
// }
//
// NOTE: You can use it like so:
// Cypress.Commands.add('customCommand', customCommand);
//
// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

import { PageIdleDetector } from './PageIdleDetector';
import { mockWebSocket } from './websocket';

/* global Cypress */
const codes = {
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40
}

Cypress.Commands.add('waitForSkeletonGone', () => {
  cy.waitUntil(() => {
    return Cypress.$('.skeleton-loader').length === 0;
  }, { verbose: true, description: "waitForSkeletonGone", errorMsg: "skeleton loaders never went away", timeout: 15000, interval: 50 });
});

Cypress.Commands.add(
  "waitForPageIdle",
  () => {
    console.warn("Waiting for page idle state");
    const pageIdleDetector = new PageIdleDetector();
    pageIdleDetector.WaitForPageToBeIdle();
  }
);

Cypress.Commands.add('mockMempoolSocket', () => {
  mockWebSocket();
});

Cypress.Commands.add('changeNetwork', (network: "testnet" | "testnet4" | "signet" | "liquid" | "mainnet") => {
  cy.get('.dropdown-toggle').click().then(() => {
    cy.get(`a.${network}`).click().then(() => {
      cy.waitForPageIdle();
      cy.waitForSkeletonGone();
    });
  });
});

// https://github.com/bahmutov/cypress-arrows/blob/8f0303842a343550fbeaf01528d01d1ff213b70c/src/index.js
function keydownCommand($el, key) {
  const message = `sending the "${key}" keydown event`
  const log = Cypress.log({
    name: `keydown: ${key}`,
    message: message,
    consoleProps: function () {
      return {
        Subject: $el
      }
    }
  })

  const e = $el.createEvent('KeyboardEvent')

  Object.defineProperty(e, 'key', {
    get: function () {
      return key
    }
  })

  Object.defineProperty(e, 'keyCode', {
    get: function () {
      return this.keyCodeVal
    }
  })
  Object.defineProperty(e, 'which', {
    get: function () {
      return this.keyCodeVal
    }
  })
  var metaKey = false

  Object.defineProperty(e, 'metaKey', {
    get: function () {
      return metaKey
    }
  })

  Object.defineProperty(e, 'shiftKey', {
    get: function () {
      return false
    }
  })
  e.keyCodeVal = codes[key]

  e.initKeyboardEvent('keydown', true, true,
    $el.defaultView, false, false, false, false, e.keyCodeVal, e.keyCodeVal)

  $el.dispatchEvent(e)
  log.snapshot().end()
  return $el
}

Cypress.Commands.add('keydown', { prevSubject: "dom" }, keydownCommand)
Cypress.Commands.add('left', { prevSubject: "dom" }, $el => keydownCommand($el, 'ArrowLeft'))
Cypress.Commands.add('right', { prevSubject: "dom" }, $el => keydownCommand($el, 'ArrowRight'))
Cypress.Commands.add('up', { prevSubject: "dom" }, $el => keydownCommand($el, 'ArrowUp'))
Cypress.Commands.add('down', { prevSubject: "dom" }, $el => keydownCommand($el, 'ArrowDown'))
