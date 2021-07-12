describe('Liquid', () => {
  beforeEach(() => {
    // TODO: Fix ng serve to deliver these files
    cy.fixture('assets.minimal').then(json => {
      cy.intercept('/resources/assets.minimal.json', json);
    });

    cy.fixture('assets').then(json => {
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
    cy.get('li:nth-of-type(3) > a')
      .click()
      .then(() => {
        cy.wait(1000);
      });
  });

  it('loads the graphs page - mobile', () => {
    cy.visit('/liquid');
    cy.get('li:nth-of-type(3) > a')
      .click()
      .then(() => {
        cy.viewport('iphone-6');
        cy.wait(1000);
        // TODO: Should we really support TV Mode in Mobile for Bisq?
        // cy.get('.tv-only').should('be.visible')
      });
  });

  describe('assets', () => {
    it('shows the assets screen', () => {
      cy.visit('/liquid');
      cy.get('li:nth-of-type(5) > a')
        .click()
        .then(() => {
          cy.get('table tr').should('have.length', 5);
        });
    });

    it('allows searching assets', () => {
      cy.visit('/liquid');
      cy.get('li:nth-of-type(5) > a')
        .click()
        .then(() => {
          cy.get('.container-xl input')
            .click()
            .type('Liquid Bitcoin')
            .then(() => {
              cy.get('table tr').should('have.length', 1);
            });
        });
    });

    it('shows a specific asset ID', () => {
      cy.visit('/liquid');
      cy.get('li:nth-of-type(5) > a')
        .click()
        .then(() => {
          cy.get('.container-xl input')
            .click()
            .type('Liquid CAD')
            .then(() => {
              cy.get('table tr td:nth-of-type(4) a').click();
            });
        });
    });

    it('shows a specific asset issuance TX', () => {
      cy.visit('/liquid');
      cy.get('li:nth-of-type(5) > a')
        .click()
        .then(() => {
          cy.get('.container-xl input')
            .click()
            .type('Liquid CAD')
            .then(() => {
              cy.get('table tr td:nth-of-type(5) a').click();
            });
        });
    });
  });

  describe('unblinded TX', () => {
    it('show unblinded TX', () => {
      cy.visit(
        '/liquid/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=100000,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,0ab9f70650f16b1db8dfada05237f7d0d65191c3a13183da8a2ddddfbde9a2ad,fd98b2edc5530d76acd553f206a431f4c1fab27e10e290ad719582af878e98fc,2364760,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,90c7a43b15b905bca045ca42a01271cfe71d2efe3133f4197792c24505cb32ed,12eb5959d9293b8842e7dd8bc9aa9639fd3fd031c5de3ba911adeca94eb57a3a'
      );
      cy.get('#table-tx-vin tr').should('have.class', 'assetBox');
      cy.get('#table-tx-vout tr').should('have.class', 'assetBox');
    });

    it('show empty unblinded TX', () => {
      cy.visit('/liquid/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=');
      cy.get('#table-tx-vin tr').should('have.class', '');
      cy.get('#table-tx-vout tr').should('have.class', '');
    });

    it('show invalid unblinded TX hex', () => {
      cy.visit('/liquid/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=123');
      cy.get('#table-tx-vin tr').should('have.class', '');
      cy.get('#table-tx-vout tr').should('have.class', '');
      cy.get('.error-unblinded').contains('Error: Invalid blinding data (invalid hex)');
    });

    it('show first unblinded vout', () => {
      cy.visit(
        '/liquid/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=100000,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,0ab9f70650f16b1db8dfada05237f7d0d65191c3a13183da8a2ddddfbde9a2ad,fd98b2edc5530d76acd553f206a431f4c1fab27e10e290ad719582af878e98fc'
      );
      cy.get('#table-tx-vout tr:first-child()').should('have.class', 'assetBox');
    });

    it('show second unblinded vout', () => {
      cy.visit(
        '/liquid/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=2364760,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,90c7a43b15b905bca045ca42a01271cfe71d2efe3133f4197792c24505cb32ed,12eb5959d9293b8842e7dd8bc9aa9639fd3fd031c5de3ba911adeca94eb57a3a'
      );
      cy.get('#table-tx-vout tr').should('have.class', 'assetBox');
    });

    it('show invalid error unblinded TX', () => {
      cy.visit(
        '/liquid/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=100000,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,0ab9f70650f16b1db8dfada05237f7d0d65191c3a13183da8a2ddddfbde9a2ad,fd98b2edc5530d76acd553f206a431f4c1fab27e10e290ad719582af878e98fc,2364760,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,90c7a43b15b905bca045ca42a01271cfe71d2efe3133f4197792c24505cb32ed,12eb5959d9293b8842e7dd8bc9aa9639fd3fd031c5de3ba911adeca94eb57a3c'
      );
      cy.get('#table-tx-vout tr').should('have.class', 'assetBox');
      cy.get('.error-unblinded').contains('Error: Invalid blinding data.');
    });
  });
});
