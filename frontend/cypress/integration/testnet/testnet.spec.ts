import { confirmAddress, emitMempoolInfo, sendWsMock, showNewTx, startTrackingAddress } from "../../support/websocket";

const baseModule = Cypress.env("BASE_MODULE");

describe('Testnet', () => {
  beforeEach(() => {
    cy.intercept('/api/block-height/*').as('block-height');
    cy.intercept('/api/block/*').as('block');
    cy.intercept('/api/block/*/txs/0').as('block-txs');
    cy.intercept('/api/tx/*/outspends').as('tx-outspends');
  });

  if (baseModule === 'mempool') {

    it('loads the dashboard', () => {
      cy.visit('/testnet');
      cy.waitForSkeletonGone();
    });

    it('check first mempool block after skeleton loads', () => {
      cy.visit('/');
      cy.waitForSkeletonGone();
      cy.get('#mempool-block-0 > .blockLink').should('exist');
    });

    it.skip('loads the dashboard with the skeleton blocks', () => {
      cy.mockMempoolSocket();
      cy.visit("/testnet");
      cy.get(':nth-child(1) > #bitcoin-block-0').should('be.visible');
      cy.get(':nth-child(2) > #bitcoin-block-0').should('be.visible');
      cy.get(':nth-child(3) > #bitcoin-block-0').should('be.visible');
      cy.get('#mempool-block-0').should('be.visible');
      cy.get('#mempool-block-1').should('be.visible');
      cy.get('#mempool-block-2').should('be.visible');

      emitMempoolInfo({
        'params': {
          loaded: true
        }
      });

      cy.get(':nth-child(1) > #bitcoin-block-0').should('not.exist');
      cy.get(':nth-child(2) > #bitcoin-block-0').should('not.exist');
      cy.get(':nth-child(3) > #bitcoin-block-0').should('not.exist');
    });

    it('loads the pools screen', () => {
      cy.visit('/testnet');
      cy.waitForSkeletonGone();
      cy.get('#btn-pools').click().then(() => {
        cy.wait(1000);
      });
    });

    it('loads the graphs screen', () => {
      cy.visit('/testnet');
      cy.waitForSkeletonGone();
      cy.get('#btn-graphs').click().then(() => {
        cy.wait(1000);
      });
    });

    describe('tv mode', () => {
      it('loads the tv screen - desktop', () => {
        cy.viewport('macbook-16');
        cy.visit('/testnet');
        cy.waitForSkeletonGone();
        cy.get('#btn-tv').click().then(() => {
          cy.wait(1000);
          cy.get('.tv-only').should('not.exist');
          //TODO: Remove comment when the bug is fixed
          //cy.get('#mempool-block-0').should('be.visible');
        });
      });

      it('loads the tv screen - mobile', () => {
        cy.visit('/testnet');
        cy.waitForSkeletonGone();
        cy.get('#btn-tv').click().then(() => {
          cy.viewport('iphone-6');
          cy.wait(1000);
          cy.get('.tv-only').should('not.exist');
        });
      });
    });


    it('loads the api screen', () => {
      cy.visit('/testnet');
      cy.waitForSkeletonGone();
      cy.get('#btn-docs').click().then(() => {
        cy.wait(1000);
      });
    });

    describe('blocks', () => {
      it('shows empty blocks properly', () => {
        cy.visit('/testnet/block/0');
        cy.waitForSkeletonGone();
        cy.get('h2').invoke('text').should('equal', '1 transaction');
      });

      it('expands and collapses the block details', () => {
        cy.visit('/testnet/block/0');
        cy.waitForSkeletonGone();
        cy.get('.btn.btn-outline-info').click().then(() => {
          cy.get('#details').should('be.visible');
        });

        cy.get('.btn.btn-outline-info').click().then(() => {
          cy.get('#details').should('not.be.visible');
        });
      });

      it('shows blocks with no pagination', () => {
        cy.visit('/testnet/block/000000000000002f8ce27716e74ecc7ad9f7b5101fed12d09e28bb721b9460ea');
        cy.waitForSkeletonGone();
        cy.get('h2').invoke('text').should('equal', '11 transactions');
        cy.get('ul.pagination').first().children().should('have.length', 5);
      });

      it('supports pagination on the block screen', () => {
        // 48 txs
        cy.visit('/testnet/block/000000000000002ca3878ebd98b313a1c2d531f2e70a6575d232ca7564dea7a9');
        cy.waitForSkeletonGone();
        cy.get('.header-bg.box > a').invoke('text').then((text1) => {
          cy.get('.active + li').first().click().then(() => {
            cy.get('.header-bg.box > a').invoke('text').then((text2) => {
              expect(text1).not.to.eq(text2);
            });
          });
        });
      });
    });
  } else {
    it.skip(`Tests cannot be run on the selected BASE_MODULE ${baseModule}`);
  }
});
