describe('Bisq', () => {
    beforeEach(() => {
        cy.intercept('/sockjs-node/info*').as('socket');
        cy.intercept('/bisq/api/markets/hloc?market=btc_usd&interval=day').as('hloc');
        cy.intercept('/bisq/api/markets/ticker').as('ticker');
        cy.intercept('/bisq/api/markets/markets').as('markets');
        cy.intercept('/bisq/api/markets/volumes/7d').as('7d');
        cy.intercept('/bisq/api/markets/trades?market=all').as('trades');
        cy.intercept('/bisq/api/txs/*/*').as('txs');
        cy.intercept('/bisq/api/blocks/*/*').as('blocks');
        cy.intercept('/bisq/api/stats').as('stats');
        
        Cypress.Commands.add('waitForDashboard', () => {
            cy.wait('@socket');
            cy.wait('@hloc');
            cy.wait('@ticker');
            cy.wait('@markets');
            cy.wait('@7d');
            cy.wait('@trades');
          });
    });

    it('loads the dashboard', () => {
        cy.visit('/bisq');
        cy.waitForSkeletonGone();
    });

    it('loads the transactions screen', () => {
        cy.visit('/bisq');
        cy.waitForSkeletonGone();
        cy.get('li:nth-of-type(2) > a').click().then(() => {
            cy.get('.table > tr').should('have.length', 50);
        });
    });

    it('loads the blocks screen', () => {
        cy.visit('/bisq');
        cy.waitForSkeletonGone();
        cy.get('li:nth-of-type(3) > a').click().then(() => {
            cy.wait('@blocks');
        });
    });

    it('loads the stats screen', () => {
        cy.visit('/bisq');
        cy.waitForSkeletonGone();
        cy.get('li:nth-of-type(4) > a').click().then(() => {
            cy.wait('@stats');
        });
    });

    it('loads the api screen', () => {
        cy.visit('/bisq');
        cy.waitForSkeletonGone();
        cy.get('li:nth-of-type(5) > a').click().then(() => {
            cy.get('.card').should('have.length.at.least', 1);
            cy.get('.card').first().click();
            cy.get('.card-body');
        });
    });

    it('shows blocks pagination with 5 pages (desktop)', () => {
        cy.viewport(760, 800);
        cy.visit('/bisq/transactions');
        cy.waitForSkeletonGone();
        // 5 pages + 4 buttons = 9 buttons
        cy.get('.pagination-container ul.pagination').first().children().should('have.length', 9);
    });

    it('shows blocks pagination with 3 pages (mobile)', () => {
        cy.viewport(669, 800);
        cy.visit('/bisq/blocks');
        cy.waitForSkeletonGone();
        // 3 pages + 4 buttons = 7 buttons
        cy.get('.pagination-container ul.pagination').first().children().should('have.length', 7);
    });

  });
