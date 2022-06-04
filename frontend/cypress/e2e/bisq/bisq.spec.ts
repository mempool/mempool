describe('Bisq', () => {
  const baseModule = Cypress.env("BASE_MODULE");
  const basePath = '';

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
  });

  if (baseModule === 'bisq') {
    it('loads the dashboard', () => {
      cy.visit(`${basePath}`);
      cy.waitForSkeletonGone();
    });

    describe("transactions", () => {
      it('loads the transactions screen', () => {
        cy.visit(`${basePath}`);
        cy.waitForSkeletonGone();
        cy.get('#btn-transactions').click().then(() => {
          cy.get('.table > tr').should('have.length', 50);
        });
      });

      const filters = [
        "Asset listing fee", "Blind vote", "Compensation request",
        "Genesis", "Irregular", "Lockup", "Pay trade fee", "Proof of burn",
        "Proposal", "Reimbursement request", "Transfer BSQ", "Unlock", "Vote reveal"
      ];
      filters.forEach((filter) => {
        it.only(`filters the transaction screen by ${filter}`, () => {
          cy.visit(`${basePath}/transactions`);
          cy.wait('@txs');
          cy.waitForSkeletonGone();
          cy.get('#filter').click();
          cy.contains(filter).find('input').click();
          cy.wait('@txs');
          cy.wait(500);
          cy.get('td:nth-of-type(2)').each(($td) => {
            expect($td.text().trim()).to.eq(filter);
          });
        });
      });

      it("filters using multiple criteria", () => {
        const filters = ['Proposal', 'Lockup', 'Unlock'];
        cy.visit(`${basePath}/transactions`);
        cy.waitForSkeletonGone();
        cy.get('#filter').click();
        filters.forEach((filter) => {
          cy.contains(filter).find('input').click();
          //TODO: change this waiter
          cy.wait(1500);
        });
        cy.get('td:nth-of-type(2)').each(($td) => {
          const regex = new RegExp(`${filters.join('|')}`, 'g');
          expect($td.text().trim()).to.match(regex);
        });
      });

      const transactions = [
        { type: 'Asset listing fee', txid: '3548aa0c002b015ea700072b7d7d76d45d4f10a3573804d0d2f624c0bb255b6b' },
        { type: 'Blind vote', txid: 'f8fabb95efa1bb81325e4c961b9fc7e3508a9b9ecd4eddf1400e58867eff8d92' },
        { type: 'Compensation request', txid: 'a8cdc65fe6bb8730f5f89f99f779d0469b0a493e1ae570e20eb7afda696a18a9' },
        { type: 'Genesis', txid: '4b5417ec5ab6112bedf539c3b4f5a806ed539542d8b717e1c4470aa3180edce5' },
        { type: 'Irregular', txid: '90b06684a517388fec2237e2362a29810dc82f0e13e019c84747ec27051e6c53' },
        { type: 'Lockup', txid: '365425b3b7487229e2ba598fb8f2a9e359e3351620383e5018548649a28b78c4' },
        { type: 'Pay trade fee', txid: 'a66b30e9777e16572ab36723539df8f45bd5d8130d810b2c3d75b8c02a191eaf' },
        { type: 'Proof of burn', txid: '8325ccb87065fb9243ed9ff1cbb431fc2ac5060a60433bcde474ccbd97b76dcb' },
        { type: 'Proposal', txid: '34e2a20f045c82fbcf7cb191b42dea6fba45641777e1751ffb29d3981c4bf413' },
        { type: 'Reimbursement request', txid: '04c16c79ca6b9ec9978880024b0d0ad3100020f33286b63c85ca7b1a319421ae' },
        { type: 'Transfer BSQ', txid: '64500bd9220675ad30d5ace27de95a341a498d7eda08162ee0ce7feb8c56cb14' },
        { type: 'Unlock', txid: '5a756841bbb11137d15b0082a3fcadbe102791f41a95d661d3bd0c5ad0b3b1a3' },
        { type: 'Vote reveal', txid: 'bd7daae1d4af8837db5e47d7bd9d8b9f83dcfd35d112f85e90728b9be45191f7' }
      ];

      transactions.forEach((transaction) => {
        it(`loads a "${transaction.type}" transaction`, () => {
          cy.visit(`${basePath}/tx/${transaction.txid}`);
          cy.waitForSkeletonGone();
        });
      });
    });

    describe('blocks', () => {
      it('loads the blocks screen', () => {
        cy.visit(`${basePath}`);
        cy.waitForSkeletonGone();
        cy.get('#btn-blocks').click().then(() => {
          cy.wait('@blocks');
          cy.get('tbody tr').should('have.length', 10);
        });
      });

      it('loads a specific block', () => {
        cy.visit(`${basePath}/block/0000000000000000000137ef33faa63bc6e809ab30932cf77d454fb36d2bd83a`);
        cy.waitForSkeletonGone();
      });

    });

    describe('markets', () => {
      it('loads the markets screen', () => {
        cy.visit(`${basePath}/markets`);
        cy.waitForSkeletonGone();
      });

      it('loads a specific market', () => {
        cy.visit(`${basePath}/market/btc_eur`);
        cy.waitForSkeletonGone();
        //Buy Offers
        cy.get('.row > :nth-child(1) td').should('have.length.at.least', 1);
        //Sell offers
        cy.get('.row > :nth-child(1) td').should('have.length.at.least', 1);
        //Trades
        cy.get('app-bisq-trades > .table-container td').should('have.length.at.least', 1);
      });
    });

    it('loads the stats screen', () => {
      cy.visit(`${basePath}`);
      cy.waitForSkeletonGone();
      cy.get('#btn-stats').click().then(() => {
        cy.wait('@stats');
      });
    });

    it('loads the api screen', () => {
      cy.visit(`${basePath}`);
      cy.waitForSkeletonGone();
      cy.get('#btn-docs').click().then(() => {
        cy.get('.section-header').should('have.length.at.least', 1);
        cy.get('.endpoint-container').should('have.length.at.least', 1);
      });
    });

    it('shows blocks pagination with 5 pages (desktop)', () => {
      cy.viewport(760, 800);
      cy.visit(`${basePath}/blocks`);
      cy.waitForSkeletonGone();
      cy.get('tbody tr').should('have.length', 10);
      // 5 pages + 4 buttons = 9 buttons
      cy.get('.pagination-container ul.pagination').first().children().should('have.length', 9);
    });

    it('shows blocks pagination with 3 pages (mobile)', () => {
      cy.viewport(669, 800);
      cy.visit(`${basePath}/blocks`);
      cy.waitForSkeletonGone();
      cy.get('tbody tr').should('have.length', 10);
      // 3 pages + 4 buttons = 7 buttons
      cy.get('.pagination-container ul.pagination').first().children().should('have.length', 7);
    });
  } else {
    it.skip(`Tests cannot be run on the selected BASE_MODULE ${baseModule}`);
  }
});
