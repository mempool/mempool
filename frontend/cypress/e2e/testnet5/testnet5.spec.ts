import { emitMempoolInfo } from '../../support/websocket';

const baseModule = Cypress.env('BASE_MODULE');

describe('Testnet5', () => {
  beforeEach(() => {
    cy.intercept('/api/block-height/*').as('block-height');
    cy.intercept('/api/block/*').as('block');
    cy.intercept('/api/block/*/txs/0').as('block-txs');
    cy.intercept('/api/tx/*/outspends').as('tx-outspends');
  });

  if (baseModule === 'mempool') {

    it('loads the dashboard', () => {
      cy.visit('/testnet5');
      cy.waitForSkeletonGone();
    });

    it('check first mempool block after skeleton loads', () => {
      cy.visit('/testnet5');
      cy.waitForSkeletonGone();
      cy.get('#mempool-block-0 > .blockLink').should('exist');
    });

    it.skip('loads the dashboard with the skeleton blocks', () => {
      cy.mockMempoolSocket();
      cy.visit('/testnet5');
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
      cy.visit('/testnet5');
      cy.waitForSkeletonGone();
      cy.get('#btn-pools').click().then(() => {
        cy.wait(1000);
      });
    });

    it('loads the graphs screen', () => {
      cy.visit('/testnet5');
      cy.waitForSkeletonGone();
      cy.get('#btn-graphs').click().then(() => {
        cy.wait(1000);
      });
    });

    it('loads the api screen', () => {
      cy.visit('/testnet5');
      cy.waitForSkeletonGone();
      cy.get('#btn-docs').click().then(() => {
        cy.wait(1000);
      });
    });

    describe('blocks', () => {
      it('shows empty blocks properly', () => {
        cy.visit('/testnet5/block/0');
        cy.get('.pagination').scrollIntoView({ offset: { top: 200, left: 0 } });
        cy.waitForSkeletonGone();
        cy.get('h2').invoke('text').should('equal', '1 transaction');
      });

      it('expands and collapses the block details', () => {
        cy.visit('/testnet5/block/0');
        cy.get('.pagination').scrollIntoView({ offset: { top: 200, left: 0 } });
        cy.waitForSkeletonGone();
        cy.get('.btn.btn-outline-info').click().then(() => {
          cy.get('#details').should('be.visible');
        });

        cy.get('.btn.btn-outline-info').click().then(() => {
          cy.get('#details').should('not.be.visible');
        });
      });

      it('shows blocks with no pagination', () => {
        // height 4330, 8 txs
        cy.visit('/testnet5/block/00000000000000bdc39d9a74784982f64654817fb93763954d4bf52fd083276c');
        cy.get('.pagination').scrollIntoView({ offset: { top: 200, left: 0 } });
        cy.waitForSkeletonGone();
        cy.get('h2').invoke('text').should('equal', '8 transactions');
        cy.get('ul.pagination').first().children().should('have.length', 5);
      });

      // No testnet5 block has more than 25 transactions yet. Point this at one and unskip it when one does.
      it.skip('supports pagination on the block screen', () => {
        cy.visit('/testnet5/block/00000000000000bdc39d9a74784982f64654817fb93763954d4bf52fd083276c');
        cy.get('.pagination').scrollIntoView({ offset: { top: 200, left: 0 } });
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
