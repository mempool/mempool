describe('Liquid', () => {
    beforeEach(() => {
        // TODO: Fix ng serve to deliver these files
        cy.fixture('assets.minimal').then((json) => {
            cy.intercept('/resources/assets.minimal.json', json);
        });

        cy.fixture('assets').then((json) => {
            cy.intercept('/resources/assets.json', json);
        });
    });

    it('loads the dashboard', () => {
        cy.visit('/liquid');
    });

    it('loads the blocks page', () => {
        cy.visit('/liquid/blocks');
    });

    it('loads a specific block page', () => {
        cy.visit('/liquid/blocks');
    });

    it('loads the graphs page', () => {
        cy.visit('/liquid/graphs');
    });

    it('loads the tv page - desktop', () => {
        cy.visit('/liquid');
        cy.get('li:nth-of-type(3) > a').click().then(() => {
            cy.wait(1000);
        });
    });

    it('loads the graphs page - mobile', () => {
        cy.visit('/liquid');
        cy.get('li:nth-of-type(3) > a').click().then(() => {
            cy.viewport('iphone-6');
            cy.wait(1000);
            // TODO: Should we really support TV Mode in Mobile for Bisq?
            // cy.get('.tv-only').should('be.visible')
        });
    });

    describe('assets', () => {
      it('shows the assets screen', () => {
        cy.visit('/liquid');
        cy.get('li:nth-of-type(5) > a').click().then(() => {
            cy.get('table tr').should('have.length', 5);
        });
      });

      it('allows searching assets', () => {
        cy.visit('/liquid');
        cy.get('li:nth-of-type(5) > a').click().then(() => {
            cy.get('.container-xl input').click().type('Liquid Bitcoin').then(() => {
                cy.get('table tr').should('have.length', 1);
            });
        });
      });

      it('shows a specific asset ID', () => {
        cy.visit('/liquid');
        cy.get('li:nth-of-type(5) > a').click().then(() => {
            cy.get('.container-xl input').click().type('Liquid CAD').then(() => {
                cy.get('table tr td:nth-of-type(4) a').click();
            });
        });
      });

      it('shows a specific asset issuance TX', () => {
        cy.visit('/liquid');
        cy.get('li:nth-of-type(5) > a').click().then(() => {
            cy.get('.container-xl input').click().type('Liquid CAD').then(() => {
                cy.get('table tr td:nth-of-type(5) a').click();
            });
        });
      });
    });
});
