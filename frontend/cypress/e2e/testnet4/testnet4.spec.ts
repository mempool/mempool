import { emitMempoolInfo } from '../../support/websocket';

const baseModule = Cypress.env('BASE_MODULE');

describe('Testnet4', () => {
  beforeEach(() => {
    cy.intercept('/api/block-height/*').as('block-height');
    cy.intercept('/api/block/*').as('block');
    cy.intercept('/api/block/*/txs/0').as('block-txs');
    cy.intercept('/api/tx/*/outspends').as('tx-outspends');
  });

  if (baseModule === 'mempool') {

    it('loads the dashboard', () => {
      cy.visit('/testnet4');
      cy.waitForSkeletonGone();
    });

    it('check first mempool block after skeleton loads', () => {
      cy.visit('/');
      cy.waitForSkeletonGone();
      cy.get('#mempool-block-0 > .blockLink').should('exist');
    });

    it.skip('loads the dashboard with the skeleton blocks', () => {
      cy.mockMempoolSocket();
      cy.visit('/testnet4');
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
      cy.visit('/testnet4');
      cy.waitForSkeletonGone();
      cy.get('#btn-pools').click().then(() => {
        cy.wait(1000);
      });
    });

    it('loads the graphs screen', () => {
      cy.visit('/testnet4');
      cy.waitForSkeletonGone();
      cy.get('#btn-graphs').click().then(() => {
        cy.wait(1000);
      });
    });

    describe('tv mode', () => {
      it('loads the tv screen - desktop', () => {
        cy.viewport('macbook-16');
        cy.visit('/testnet4/graphs');
        cy.waitForSkeletonGone();
        cy.get('#btn-tv').click().then(() => {
          cy.wait(1000);
          cy.get('.tv-only').should('not.exist');
          cy.get('#mempool-block-0').should('be.visible');
        });
      });

      it('loads the tv screen - mobile', () => {
        cy.visit('/testnet4/graphs');
        cy.waitForSkeletonGone();
        cy.get('#btn-tv').click().then(() => {
          cy.viewport('iphone-6');
          cy.wait(1000);
          cy.get('.tv-only').should('not.exist');
        });
      });
    });


    it('loads the api screen', () => {
      cy.visit('/testnet4');
      cy.waitForSkeletonGone();
      cy.get('#btn-docs').click().then(() => {
        cy.wait(1000);
      });
    });

    describe('blocks', () => {
      it('shows empty blocks properly', () => {
        cy.visit('/testnet4/block/0');
        cy.get('.pagination').scrollIntoView({ offset: { top: 200, left: 0 } });
        cy.waitForSkeletonGone();
        cy.get('h2').invoke('text').should('equal', '1 transaction');
      });

      it('expands and collapses the block details', () => {
        cy.visit('/testnet4/block/0');
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
        cy.visit('/testnet4/block/000000000066e8b6cc78a93f8989587f5819624bae2eb1c05f535cadded19f99');
        cy.get('.pagination').scrollIntoView({ offset: { top: 200, left: 0 } });
        cy.waitForSkeletonGone();
        cy.get('h2').invoke('text').should('equal', '18 transactions');
        cy.get('ul.pagination').first().children().should('have.length', 5);
      });

      it('supports pagination on the block screen', () => {
        // 48 txs
        cy.visit('/testnet4/block/000000000000006982d53f8273bdff21dafc380c292eabc669b5ab6d732311c3');
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
