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

    it('check opreturn burned icon', () => {
        cy.visit('/testnet/tx/340e112617871db69b98bfce262159fff02f3a64b75c192338d1b7baed93e96f');
        cy.waitForSkeletonGone();
        cy.get('.opreturn-icon > .ng-fa-icon > .svg-inline--fa').should('be.visible');
    });

    it('check opreturn burned tooltip', () => {
        cy.visit('/testnet/tx/340e112617871db69b98bfce262159fff02f3a64b75c192338d1b7baed93e96f');
        cy.waitForSkeletonGone();
        cy.get('.opreturn-icon > .ng-fa-icon > .svg-inline--fa').first().trigger('onmouseover');
        cy.get('.opreturn-icon > .ng-fa-icon > .svg-inline--fa').first().trigger('mouseenter');
        cy.get('.tooltip-inner').should('be.visible');
    });

    it('check opreturn not burned', () => {
        cy.visit('/testnet/block/00000000000000222c79e3600bdc87a6f21db40061d99c813db554598d184189');
        cy.waitForSkeletonGone();
        cy.get('app-transactions-list > :nth-child(2) .opreturn-icon > .ng-fa-icon > .svg-inline--fa').should('not.be.NaN');
    });

    it('check first mempool block after skeleton loads', () => {
      cy.visit('/');
      cy.waitForSkeletonGone();
      cy.get('#mempool-block-0 > .blockLink').should('exist');
    });

    it('loads the dashboard with the skeleton blocks', () => {
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

    it('loads the blocks screen', () => {
        cy.visit('/testnet');
        cy.waitForSkeletonGone();
        cy.get('li:nth-of-type(2) > a').click().then(() => {
            cy.wait(1000);
        });
    });

    it('loads the graphs screen', () => {
        cy.visit('/testnet');
        cy.waitForSkeletonGone();
        cy.get('li:nth-of-type(3) > a').click().then(() => {
            cy.wait(1000);
        });
    });

    describe('tv mode', () => {
        it('loads the tv screen - desktop', () => {
            cy.viewport('macbook-16');
            cy.visit('/testnet');
            cy.waitForSkeletonGone();
            cy.get('li:nth-of-type(4) > a').click().then(() => {
                cy.wait(1000);
                cy.get('.tv-only').should('not.exist');
            });
        });

        it('loads the tv screen - mobile', () => {
            cy.visit('/testnet');
            cy.waitForSkeletonGone();
            cy.get('li:nth-of-type(4) > a').click().then(() => {
                cy.viewport('iphone-6');
                cy.wait(1000);
                cy.get('.tv-only').should('not.exist');
            });
        });
    });


    it('loads the api screen', () => {
        cy.visit('/testnet');
        cy.waitForSkeletonGone();
        cy.get('li:nth-of-type(5) > a').click().then(() => {
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
