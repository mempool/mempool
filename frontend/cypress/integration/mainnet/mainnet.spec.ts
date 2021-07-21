describe('Mainnet', () => {
    beforeEach(() => {
        cy.intercept('/sockjs-node/info*').as('socket');
        cy.intercept('/api/block-height/*').as('block-height');
        cy.intercept('/api/block/*').as('block');
        cy.intercept('/api/block/*/txs/0').as('block-txs');
        cy.intercept('/api/tx/*/outspends').as('tx-outspends');
        cy.intercept('/resources/pools.json').as('pools');

        Cypress.Commands.add('waitForBlockData', () => {
            cy.wait('@socket');
            cy.wait('@tx-outspends');
            cy.wait('@pools');
          });
    });

    it('loads the dashboard', () => {
      cy.visit('/');
      cy.waitForSkeletonGone();
    });

    it('loads the dashboard with the skeleton blocks', () => {
      cy.visit('/');

      cy.intercept('/sockjs-node/info/**', () => {
        cy.get('#mempool-block-0').should('be.visible');
        cy.get('#mempool-block-1').should('be.visible');
        cy.get('#mempool-block-2').should('be.visible');
        cy.get(':nth-child(1) > #bitcoin-block-0').should('be.visible');
        cy.get(':nth-child(2) > #bitcoin-block-0').should('be.visible');
        cy.get(':nth-child(3) > #bitcoin-block-0').should('be.visible');
      });
      cy.waitForSkeletonGone();

    });

    it('loads the blocks screen', () => {
        cy.visit('/');
        cy.waitForSkeletonGone();
        cy.get('li:nth-of-type(2) > a').click().then(() => {
           cy.wait(1000);
        });
    });

    it('loads the graphs screen', () => {
        cy.visit('/');
        cy.waitForSkeletonGone();
        cy.get('li:nth-of-type(3) > a').click().then(() => {
            cy.wait(1000);
        });
    });

    describe('tv mode', () => {
        it('loads the tv screen - desktop', () => {
            cy.viewport('macbook-16');
            cy.visit('/');
            cy.waitForSkeletonGone();
            cy.get('li:nth-of-type(4) > a').click().then(() => {
                cy.viewport('macbook-16');
                cy.wait(1000);
                cy.get('.blockchain-wrapper').should('be.visible');
                cy.get('#mempool-block-0').should('be.visible');
                //cy.get('#mempool-block-1').should('be.visible');
                //cy.get('#mempool-block-2').should('be.visible');
            });
        });

        it('loads the tv screen - mobile', () => {
            cy.visit('/');
            cy.waitForSkeletonGone();
            cy.get('li:nth-of-type(4) > a').click().then(() => {
                cy.viewport('iphone-6');
                cy.wait(1000);
                cy.get('.blockchain-wrapper').should('not.be.visible');
            });
        });
    });


    it('loads the api screen', () => {
        cy.visit('/');
        cy.waitForSkeletonGone();
        cy.get('li:nth-of-type(5) > a').click().then(() => {
            cy.wait(1000);
        });
    });

    describe('blocks', () => {
        it('shows empty blocks properly', () => {
            cy.visit('/block/0000000000000000000bd14f744ef2e006e61c32214670de7eb891a5732ee775');
            cy.waitForSkeletonGone();
            cy.get('h2').invoke('text').should('equal', '1 transaction');
        });

        it('expands and collapses the block details', () => {
            cy.visit('/block/0');
            cy.waitForSkeletonGone();
            cy.get('.btn.btn-outline-info').click().then(() => {
                cy.get('#details').should('be.visible');
            });

            cy.get('.btn.btn-outline-info').click().then(() => {
                cy.get('#details').should('not.be.visible');
            });
        });
        it('shows blocks with no pagination', () => {
            cy.visit('/block/00000000000000000001ba40caf1ad4cec0ceb77692662315c151953bfd7c4c4');
            cy.waitForSkeletonGone();
            cy.get('.block-tx-title h2').invoke('text').should('equal', '19 transactions');
            cy.get('.pagination-container ul.pagination').first().children().should('have.length', 5);
        });

        it('supports pagination on the block screen', () => {
            // 41 txs
            cy.visit('/block/00000000000000000009f9b7b0f63ad50053ad12ec3b7f5ca951332f134f83d8');
            cy.waitForSkeletonGone();
            cy.get('.pagination-container a').invoke('text').then((text1) => {
                cy.get('.active + li').first().click().then(() => {
                    cy.waitForSkeletonGone();
                    cy.get('.header-bg.box > a').invoke('text').then((text2) => {
                        expect(text1).not.to.eq(text2);
                    });
                });
            });
        });

        it('shows blocks pagination with 5 pages (desktop)', () => {
            cy.viewport(760, 800);
            cy.visit('/block/000000000000000000049281946d26fcba7d99fdabc1feac524bc3a7003d69b3').then(() => {
                cy.waitForSkeletonGone();
            });
            
            // 5 pages + 4 buttons = 9 buttons
            cy.get('.pagination-container ul.pagination').first().children().should('have.length', 9);
        });

        it('shows blocks pagination with 3 pages (mobile)', () => {
            cy.viewport(669, 800);
            cy.visit('/block/000000000000000000049281946d26fcba7d99fdabc1feac524bc3a7003d69b3').then(() => {
                cy.waitForSkeletonGone();
            });
            
            // 3 pages + 4 buttons = 7 buttons
            cy.get('.pagination-container ul.pagination').first().children().should('have.length', 7);
        });
    });
});
