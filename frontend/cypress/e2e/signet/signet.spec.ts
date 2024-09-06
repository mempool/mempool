import { emitMempoolInfo } from '../../support/websocket';

const baseModule = Cypress.env('BASE_MODULE');

describe('Signet', () => {
  beforeEach(() => {
    cy.intercept('/api/block-height/*').as('block-height');
    cy.intercept('/api/block/*').as('block');
    cy.intercept('/api/block/*/txs/0').as('block-txs');
    cy.intercept('/api/tx/*/outspends').as('tx-outspends');
  });


  if (baseModule === 'mempool') {
    it('loads the dashboard', () => {
      cy.visit('/signet');
      cy.waitForSkeletonGone();
    });

    it('check first mempool block after skeleton loads', () => {
      cy.visit('/');
      cy.waitForSkeletonGone();
      cy.get('#mempool-block-0 > .blockLink').should('exist');
    });

    it.skip('loads the dashboard with the skeleton blocks', () => {
      cy.mockMempoolSocket();
      cy.visit('/signet');
      cy.get(':nth-child(1) > #bitcoin-block-0').should('be.visible');
      cy.get(':nth-child(2) > #bitcoin-block-0').should('be.visible');
      cy.get(':nth-child(3) > #bitcoin-block-0').should('be.visible');
      cy.get('#mempool-block-0').should('be.visible');
      cy.get('#mempool-block-1').should('be.visible');
      cy.get('#mempool-block-2').should('be.visible');

      emitMempoolInfo({
        'params': {
          'network': 'signet'
        }
      });

      cy.get(':nth-child(1) > #bitcoin-block-0').should('not.exist');
      cy.get(':nth-child(2) > #bitcoin-block-0').should('not.exist');
      cy.get(':nth-child(3) > #bitcoin-block-0').should('not.exist');
    });

    it('loads the pools screen', () => {
      cy.visit('/signet');
      cy.waitForSkeletonGone();
      cy.get('#btn-pools').click().then(() => {
        cy.wait(1000);
      });
    });

    it('loads the graphs screen', () => {
      cy.visit('/signet');
      cy.waitForSkeletonGone();
      cy.get('#btn-graphs').click().then(() => {
        cy.wait(1000);
      });
    });

    describe.skip('tv mode', () => {
      it('loads the tv screen - desktop', () => {
        cy.viewport('macbook-16');
        cy.visit('/signet/graphs');
        cy.waitForSkeletonGone();
        cy.get('#btn-tv').click().then(() => {
          cy.get('.chart-holder').should('be.visible');
          cy.get('#mempool-block-0').should('be.visible');
          cy.get('.tv-only').should('not.exist');
        });
      });

      it('loads the tv screen - mobile', () => {
        cy.visit('/signet/graphs');
        cy.waitForSkeletonGone();
        cy.get('#btn-tv').click().then(() => {
          cy.viewport('iphone-8');
          cy.get('.chart-holder').should('be.visible');
          cy.get('.tv-only').should('not.exist');
          cy.get('#mempool-block-0').should('be.visible');
        });
      });
    });

    it('loads the api screen', () => {
      cy.visit('/signet');
      cy.waitForSkeletonGone();
      cy.get('#btn-docs').click().then(() => {
        cy.wait(1000);
      });
    });

    describe('blocks', () => {
      it('shows empty blocks properly', () => {
        cy.visit('/signet/block/00000133d54e4589f6436703b067ec23209e0a21b8a9b12f57d0592fd85f7a42');
        cy.get('.pagination').scrollIntoView({ offset: { top: 200, left: 0 } });
        cy.waitForSkeletonGone();
        cy.get('h2').invoke('text').should('equal', '1 transaction');
      });

      it('expands and collapses the block details', () => {
        cy.visit('/signet/block/0');
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
        cy.visit('/signet/block/00000078f920a96a69089877b934ce7fd009ab55e3170920a021262cb258e7cc');
        cy.get('.pagination').scrollIntoView({ offset: { top: 200, left: 0 } });
        cy.waitForSkeletonGone();
        cy.get('h2').invoke('text').should('equal', '13 transactions');
        cy.get('ul.pagination').first().children().should('have.length', 5);
      });

      it('supports pagination on the block screen', () => {
        // 43 txs
        cy.visit('/signet/block/00000094bd52f73bdbfc4bece3a94c21fec2dc968cd54210496e69e4059d66a6');
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
