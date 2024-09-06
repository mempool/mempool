describe('Liquid Testnet', () => {
  const baseModule = Cypress.env('BASE_MODULE');
  const basePath = '/testnet';

  beforeEach(() => {
    cy.intercept('/liquidtestnet/api/block/**').as('block');
    cy.intercept('/liquidtestnet/api/blocks/').as('blocks');
    cy.intercept('/liquidtestnet/api/tx/**/outspends').as('outspends');
    cy.intercept('/liquidtestnet/api/block/**/txs/**').as('block-txs');

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

    it('loads the dashboard', () => {
      cy.visit(`${basePath}`);
      cy.waitForSkeletonGone();
    });

    it.skip('loads the dashboard with no scrollbars on mobile', () => {
      cy.viewport('iphone-xr');
      cy.visit(`${basePath}`);
      cy.waitForSkeletonGone();
      cy.window().then(window => {
        const htmlWidth = Cypress.$('html')[0].scrollWidth;
        const scrollBarWidth = window.innerWidth - htmlWidth;
        expect(scrollBarWidth).to.be.eq(0);  //check for no horizontal scrollbar
      });
    });

    it('loads the blocks page', () => {
      cy.visit(`${basePath}`)
      cy.get('#btn-blocks');
      cy.waitForSkeletonGone();
    });

    it('loads a specific block page', () => {
      cy.visit(`${basePath}/block/fb4cbcbff3993ca4bf8caf657d55a23db5ed4ab1cfa33c489303c2e04e1c38e0`);
      cy.get('.pagination').scrollIntoView({ offset: { top: 200, left: 0 } });
      cy.waitForSkeletonGone();
    });

    it('loads the graphs page', () => {
      cy.visit(`${basePath}`);
      cy.get('#btn-graphs');
      cy.waitForSkeletonGone();
    });

    it('loads the tv page - desktop', () => {
      cy.visit(`${basePath}/tv`);
      cy.waitForSkeletonGone();
    });

    it('loads the graphs page - mobile', () => {
      cy.visit(`${basePath}`)
      cy.waitForSkeletonGone();
      cy.viewport('iphone-6');
      cy.get('.tv-only').should('not.exist');
    });

    it.skip('renders unconfidential transactions correctly on mobile', () => {
      cy.viewport('iphone-xr');
      cy.visit(`${basePath}/tx/b119f338878416781dc285b94c0de52826341dea43566e4de4740d3ebfd1f6dc#blinded=99707,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,1377e4ec8eb0c89296e14ffca57e377f4b51ad8f1c881e43364434d8430dbfda,cdd6caae4c3452586cfcb107478dd2b7acaa5f82714a6a966578255e857eee60`);
      cy.waitForSkeletonGone();
      cy.window().then(window => {
        const htmlWidth = Cypress.$('html')[0].scrollWidth;
        const scrollBarWidth = window.innerWidth - htmlWidth;
        expect(scrollBarWidth).to.be.eq(0);  //check for no horizontal scrollbar
      });
    });

    describe('assets', () => {
      it('allows searching assets', () => {
        cy.visit(`${basePath}/assets`);
        cy.waitForSkeletonGone();
        cy.get('.container-xl input').click().type('Liquid Bitcoin').then(() => {
          cy.get('ngb-typeahead-window').should('have.length', 1);
        });
      });

      it('shows a specific asset ID', () => {
        cy.visit(`${basePath}/assets`);
        cy.waitForSkeletonGone();
        cy.get('.container-xl input').click().type('Liquid CAD').then(() => {
          cy.get('ngb-typeahead-window:nth-of-type(1) button').click();
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
        cy.visit(`${basePath}/tx/c3d908ab77891e4c569b0df71aae90f4720b157019ebb20db176f4f9c4d626b8#blinded=100000,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,df290ead654d7d110ebc5aaf0bcf11d5b5d360431a467f1cde0a856fde986893,33cb3a2fd2e76643843691cf44a78c5cd28ec652a414da752160ad63fbd37bc9,49741,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,edb0713bcbfcb3daabf601cb50978439667d208e15fed8a5ebbfea5696cda1d5,4de70115501e8c7d6bd763e229bf42781edeacf6e75e1d7bdfa4c63104bc508a`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vin tr:nth-child(1) .amount').should('contain.text', '0.00100000 tL-BTC');
        cy.get('.table-tx-vin tr').should('have.class', 'assetBox');
        cy.get('.table-tx-vout tr:nth-child(1) .amount').should('contain.text', '0.00050000 tL-BTC');
        cy.get('.table-tx-vout tr:nth-child(2) .amount').should('contain.text', '0.00049741 tL-BTC');
        cy.get('.table-tx-vout tr').should('have.class', 'assetBox');
      });

      it('show empty unblinded TX', () => {
        cy.visit(`${basePath}/tx/c3d908ab77891e4c569b0df71aae90f4720b157019ebb20db176f4f9c4d626b8#blinded=`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vin tr:nth-child(1)').should('have.class', 'ng-star-inserted');
        cy.get('.table-tx-vin tr:nth-child(1) .amount').should('contain.text', 'Confidential');
        cy.get('.table-tx-vout tr:nth-child(1)').should('have.class', 'ng-star-inserted');
        cy.get('.table-tx-vout tr:nth-child(2)').should('have.class', 'ng-star-inserted');
        cy.get('.table-tx-vout tr:nth-child(1) .amount').should('contain.text', 'Confidential');
        cy.get('.table-tx-vout tr:nth-child(2) .amount').should('contain.text', 'Confidential');
      });

      it('show invalid unblinded TX hex', () => {
        cy.visit(`${basePath}/tx/2477f220eef1d03f8ffa4a2861c275d155c3562adf0d79523aeeb0c59ee611ba#blinded=5000`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vin tr').should('have.class', 'ng-star-inserted');
        cy.get('.table-tx-vout tr').should('have.class', 'ng-star-inserted');
        cy.get('.error-unblinded').contains('Error: Invalid blinding data (invalid hex)');
      });

      it('show first unblinded vout', () => {
        cy.visit(`${basePath}/tx/0877bc0c7aa5c2b8d0e4b15450425879b8783c40e341806037a605ef836fb886#blinded=5000,38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5,328de54e90e867a9154b4f1eb7fcab86267e880fa2ee9e53b41a91e61dab86e6,8885831e6b089eaf06889d53a24843f0da533d300a7b1527b136883a6819f3ae,5000,38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5,aca78b953615d69ae0ae68c4c5c3c0ee077c10bc20ad3f0c5960706004e6cb56,d2ec175afe5f761e2dbd443faf46abbb7091f341deb3387e5787d812bdb2df9f,100000,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,4b54a4ca809b3844f34dd88b68617c4c866d92a02211f02ba355755bac20a1c6,eddd02e92b0cfbad8cab89828570a50f2c643bb2a54d886c86e25ce47e818685,99729,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,8b86d565c9549eb0352bb81ee576d01d064435b64fddcc045decebeb1d9913ce,b082ce3448d40d47b5b39f15d72b285f4a1046b636b56c25f32f498ece29d062,10000,38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5,62b04ee86198d6b41681cdd0acb450ab366af727a010aaee8ba0b9e69ff43896,3f98429bca9b538dc943c22111f25d9c4448d45a63ff0f4e58b22fd434c0365e`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vout tr:nth-child(1)').should('have.class', 'assetBox');
        cy.get('.table-tx-vout tr:nth-child(1) .amount').should('contain.text', '0.00099729 tL-BTC');
      });

      it('show second unblinded vout (asset)', () => {
        cy.visit(`${basePath}/tx/0877bc0c7aa5c2b8d0e4b15450425879b8783c40e341806037a605ef836fb886#blinded=5000,38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5,328de54e90e867a9154b4f1eb7fcab86267e880fa2ee9e53b41a91e61dab86e6,8885831e6b089eaf06889d53a24843f0da533d300a7b1527b136883a6819f3ae,5000,38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5,aca78b953615d69ae0ae68c4c5c3c0ee077c10bc20ad3f0c5960706004e6cb56,d2ec175afe5f761e2dbd443faf46abbb7091f341deb3387e5787d812bdb2df9f,100000,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,4b54a4ca809b3844f34dd88b68617c4c866d92a02211f02ba355755bac20a1c6,eddd02e92b0cfbad8cab89828570a50f2c643bb2a54d886c86e25ce47e818685,99729,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,8b86d565c9549eb0352bb81ee576d01d064435b64fddcc045decebeb1d9913ce,b082ce3448d40d47b5b39f15d72b285f4a1046b636b56c25f32f498ece29d062,10000,38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5,62b04ee86198d6b41681cdd0acb450ab366af727a010aaee8ba0b9e69ff43896,3f98429bca9b538dc943c22111f25d9c4448d45a63ff0f4e58b22fd434c0365e`);
        cy.get('.table-tx-vout tr:nth-child(2)').should('have.class', 'assetBox');
        //TODO Update after the precision bug fix is merged
        cy.get('.table-tx-vout tr:nth-child(2) .amount').should('contain.text', '0 TEST');
      });

      it('should link to the asset page from the unblinded tx', () => {
        cy.visit(`${basePath}/tx/0877bc0c7aa5c2b8d0e4b15450425879b8783c40e341806037a605ef836fb886#blinded=5000,38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5,328de54e90e867a9154b4f1eb7fcab86267e880fa2ee9e53b41a91e61dab86e6,8885831e6b089eaf06889d53a24843f0da533d300a7b1527b136883a6819f3ae,5000,38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5,aca78b953615d69ae0ae68c4c5c3c0ee077c10bc20ad3f0c5960706004e6cb56,d2ec175afe5f761e2dbd443faf46abbb7091f341deb3387e5787d812bdb2df9f,100000,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,4b54a4ca809b3844f34dd88b68617c4c866d92a02211f02ba355755bac20a1c6,eddd02e92b0cfbad8cab89828570a50f2c643bb2a54d886c86e25ce47e818685,99729,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,8b86d565c9549eb0352bb81ee576d01d064435b64fddcc045decebeb1d9913ce,b082ce3448d40d47b5b39f15d72b285f4a1046b636b56c25f32f498ece29d062,10000,38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5,62b04ee86198d6b41681cdd0acb450ab366af727a010aaee8ba0b9e69ff43896,3f98429bca9b538dc943c22111f25d9c4448d45a63ff0f4e58b22fd434c0365e`);
        cy.get('.table-tx-vout tr:nth-child(2) .amount a').click().then(() => {
          cy.waitForSkeletonGone();
          cy.url().should('contain', '/assets/asset/38fca2d939696061a8f76d4e6b5eecd54e3b4221c846f24a6b279e79952850a5');
        });
      });

      it('show invalid error unblinded TX', () => {
        cy.visit(`${basePath}/tx/c3d908ab77891e4c569b0df71aae90f4720b157019ebb20db176f4f9c4d626b8#blinded=100000,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,df290ead654d7d110ebc5aaf0bcf11d5b5d360431a467f1cde0a856fde986893,33cb3a2fd2e76643843691cf44a78c5cd28ec652a414da752160ad63fbd37bc9,49741,144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49,edb0713bcbfcb3daabf601cb50978439667d208e15fed8a5ebbfea5696cda1d5,4de70115501e8c7d6bd763e229bf42781edeacf6e75e1d7bdfa4c63104bc508c`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vin tr').should('have.class', 'assetBox');
        cy.get('.error-unblinded').contains('Error: Invalid blinding data.');
      });

      it('shows asset peg in/out and burn transactions', () => {
        cy.visit(`${basePath}/assets/asset/ac3e0ff248c5051ffd61e00155b7122e5ebc04fd397a0ecbdd4f4e4a56232926`);
        cy.waitForSkeletonGone();
        cy.get('.table-tx-vout tr').not('.assetBox');
        cy.get('.table-tx-vin tr').not('.assetBox');
      });

    });
  } else {
    it.skip(`Tests cannot be run on the selected BASE_MODULE ${baseModule}`);
  }
});
