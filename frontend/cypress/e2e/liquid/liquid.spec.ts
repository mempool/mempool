describe('Liquid', () => {
  const baseModule = Cypress.env('BASE_MODULE');
  const basePath = '';

  beforeEach(() => {
    cy.intercept('/liquid/api/block/**').as('block');
    cy.intercept('/liquid/api/blocks/').as('blocks');
    cy.intercept('/liquid/api/tx/**/outspends').as('outspends');
    cy.intercept('/liquid/api/block/**/txs/**').as('block-txs');

    Cypress.Commands.add('waitForBlockData', () => {
      cy.wait('@socket');
      cy.wait('@block');
      cy.wait('@outspends');
    });
  });

  if (baseModule === 'liquid') {

    it('check first mempool block after skeleton loads', () => {
      cy.visit(`${basePath}`);
      cy.waitForSkeletonGone();
      cy.get('#mempool-block-0 > .blockLink').should('exist');
    });

    it('load first mempool block after skeleton loads', () => {
      cy.visit(`${basePath}`);
      cy.waitForSkeletonGone();
      cy.get('#mempool-block-0 > .blockLink').click();
      cy.waitForSkeletonGone();
    });

    it('loads the dashboard', () => {
      cy.visit(`${basePath}`);
      cy.waitForSkeletonGone();
    });

    it('loads the blocks page', () => {
      cy.visit(`${basePath}`);
      cy.get('#btn-blocks').click().then(() => {
        cy.wait(1000);
      });
      cy.waitForSkeletonGone();
    });

    it('loads a specific block page', () => {
      cy.visit(`${basePath}/block/7e1369a23a5ab861e7bdede2aadcccae4ea873ffd9caf11c7c5541eb5bcdff54`);
      cy.get('.pagination').scrollIntoView({ offset: { top: 200, left: 0 } });
      cy.waitForSkeletonGone();
    });

    it('loads the graphs page', () => {
      cy.visit(`${basePath}`);
      cy.waitForSkeletonGone();
      cy.get('#btn-graphs').click().then(() => {
        cy.wait(1000);
      });
    });

    it('loads the tv page - desktop', () => {
      cy.visit(`${basePath}/tv`);
      cy.waitForSkeletonGone();
    });

    it('loads the graphs page - mobile', () => {
      cy.visit(`${basePath}`)
      cy.waitForSkeletonGone();
      cy.get('#btn-graphs').click().then(() => {
        cy.viewport('iphone-6');
        cy.wait(1000);
        cy.get('.tv-only').should('not.exist');
      });
    });

    describe('peg in/peg out', () => {
      it('loads peg in addresses', () => {
        cy.visit(`${basePath}/tx/fe764f7bedfc2a37b29d9c8aef67d64a57d253a6b11c5a55555cfd5826483a58`);
        cy.waitForSkeletonGone();
        //TODO: Change to an element id so we don't assert on a string
        cy.get('.table-tx-vin').should('contain', 'Peg-in');
        //Remove the target=_blank attribute so the new url opens in the same tab
        cy.get('.table-tx-vin a').invoke('removeAttr', 'target').click().then(() => {
          cy.waitForSkeletonGone();
          if (baseModule === 'liquid') {
            cy.url().should('eq', 'https://mempool.space/tx/f148c0d854db4174ea420655235f910543f0ec3680566dcfdf84fb0a1697b592#vout=0');
          } else {
            //TODO: Use an environment variable to get the hostname
            cy.url().should('eq', 'http://localhost:4200/tx/f148c0d854db4174ea420655235f910543f0ec3680566dcfdf84fb0a1697b592');
          }
        });
      });

      it('loads peg out addresses', () => {
        cy.visit(`${basePath}/tx/ecf6eba04ffb3946faa172343c87162df76f1a57b07b0d6dc6ad956b13376dc8`);
        cy.waitForSkeletonGone();
        //Remove the target=_blank attribute so the new url opens in the same tab
        cy.get('.table-tx-vout a').first().invoke('removeAttr', 'target').click().then(() => {
          cy.waitForSkeletonGone();
          if (baseModule === 'liquid') {
            cy.url().should('eq', 'https://mempool.space/address/1BxoGcMg14oaH3CwHD2hF4gU9VcfgX5yoR');
          } else {
            //TODO: Use an environment variable to get the hostname
            cy.url().should('eq', 'http://localhost:4200/address/1BxoGcMg14oaH3CwHD2hF4gU9VcfgX5yoR');
          }
          //TODO: Add a custom class so we don't assert on a string
          cy.get('.badge').should('contain', 'Liquid Peg Out');
        });
      });
    });

    describe('assets', () => {
      it('shows the assets screen', () => {
        cy.visit(`${basePath}/assets`);
        cy.waitForSkeletonGone();
        cy.get('.featuredBox .card').should('have.length.at.least', 5);
      });

      it('allows searching assets', () => {
        cy.visit(`${basePath}/assets`);
        cy.waitForSkeletonGone();
        cy.get('.container-xl input').click().type('Liquid Bitcoin').then(() => {
          cy.get('ngb-typeahead-window', { timeout: 30000 }).should('have.length', 1);
        });
      });

      it('shows a specific asset ID', () => {
        cy.visit(`${basePath}/assets`);
        cy.waitForSkeletonGone();
        cy.get('.container-xl input').click().type('Liquid AUD').then(() => {
          cy.get('ngb-typeahead-window:nth-of-type(1) button', { timeout: 30000 }).click();
        });
      });
    });


    describe('unblinded TX', () => {

      it('should not show an unblinding error message for regular txs', () => {
        cy.visit(`${basePath}/tx/82a479043ec3841e0d3f829afc8df4f0e2bbd675a13f013ea611b2fde0027d45`);
        cy.waitForSkeletonGone();
        cy.get('.error-unblinded').should('not.exist');
      });

      it('show unblinded TX', () => {
        cy.visit(`${basePath}/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=100000,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,0ab9f70650f16b1db8dfada05237f7d0d65191c3a13183da8a2ddddfbde9a2ad,fd98b2edc5530d76acd553f206a431f4c1fab27e10e290ad719582af878e98fc,2364760,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,90c7a43b15b905bca045ca42a01271cfe71d2efe3133f4197792c24505cb32ed,12eb5959d9293b8842e7dd8bc9aa9639fd3fd031c5de3ba911adeca94eb57a3a`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vin tr:nth-child(1) .amount').should('contain.text', '0.02465000 L-BTC');
        cy.get('.table-tx-vin tr').should('have.class', 'assetBox');
        cy.get('.table-tx-vout tr:nth-child(1) .amount').should('contain.text', '0.00100000 L-BTC');
        cy.get('.table-tx-vout tr:nth-child(2) .amount').should('contain.text', '0.02364760 L-BTC');
        cy.get('.table-tx-vout tr').should('have.class', 'assetBox');
      });

      it('show empty unblinded TX', () => {
        cy.visit(`${basePath}/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vin tr:nth-child(1)').should('have.class', 'ng-star-inserted');
        cy.get('.table-tx-vin tr:nth-child(1) .amount').should('contain.text', 'Confidential');
        cy.get('.table-tx-vout tr:nth-child(1)').should('have.class', 'ng-star-inserted');
        cy.get('.table-tx-vout tr:nth-child(2)').should('have.class', 'ng-star-inserted');
        cy.get('.table-tx-vout tr:nth-child(1) .amount').should('contain.text', 'Confidential');
        cy.get('.table-tx-vout tr:nth-child(2) .amount').should('contain.text', 'Confidential');
      });

      it('show invalid unblinded TX hex', () => {
        cy.visit(`${basePath}/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=123`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vin tr').should('have.class', 'ng-star-inserted');
        cy.get('.table-tx-vout tr').should('have.class', 'ng-star-inserted');
        cy.get('.error-unblinded').contains('Error: Invalid blinding data (invalid hex)');
      });

      it('show first unblinded vout', () => {
        cy.visit(`${basePath}/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=100000,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,0ab9f70650f16b1db8dfada05237f7d0d65191c3a13183da8a2ddddfbde9a2ad,fd98b2edc5530d76acd553f206a431f4c1fab27e10e290ad719582af878e98fc`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vout tr:nth-child(1)').should('have.class', 'assetBox');
        cy.get('.table-tx-vout tr:nth-child(1) .amount').should('contain.text', '0.00100000 L-BTC');
      });

      it('show second unblinded vout', () => {
        cy.visit(`${basePath}/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=2364760,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,90c7a43b15b905bca045ca42a01271cfe71d2efe3133f4197792c24505cb32ed,12eb5959d9293b8842e7dd8bc9aa9639fd3fd031c5de3ba911adeca94eb57a3a`);
        cy.get('.table-tx-vout tr:nth-child(2').should('have.class', 'assetBox');
        cy.get('.table-tx-vout tr:nth-child(2) .amount').should('contain.text', '0.02364760 L-BTC');
      });

      it('show invalid error unblinded TX', () => {
        cy.visit(`${basePath}/tx/f2f41c0850e8e7e3f1af233161fd596662e67c11ef10ed15943884186fbb7f46#blinded=100000,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,0ab9f70650f16b1db8dfada05237f7d0d65191c3a13183da8a2ddddfbde9a2ad,fd98b2edc5530d76acd553f206a431f4c1fab27e10e290ad719582af878e98fc,2364760,6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d,90c7a43b15b905bca045ca42a01271cfe71d2efe3133f4197792c24505cb32ed,12eb5959d9293b8842e7dd8bc9aa9639fd3fd031c5de3ba911adeca94eb57a3c`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vout tr').should('have.class', 'assetBox');
        cy.get('.error-unblinded').contains('Error: Invalid blinding data.');
      });

      it('shows asset peg in/out and burn transactions', () => {
        cy.visit(`${basePath}/assets/asset/6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vout tr').not('.assetBox');
        cy.get('.table-tx-vin tr').not('.assetBox');
      });

      it('prevents regressing issue #644', () => {
        cy.visit(`${basePath}/tx/393b890966f305e7c440fcfb12a13f51a7a9011cc59ff5f14f6f93214261bd82`);
        cy.waitForSkeletonGone();
      });
    });
  } else {
    it.skip(`Tests cannot be run on the selected BASE_MODULE ${baseModule}`);
  }
});
