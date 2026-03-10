const baseModule = Cypress.env('BASE_MODULE');

// Helper to select "Fiat" from the BTC/sats/Fiat amount selector dropdown
const selectFiatMode = () => {
  cy.get('app-amount-selector').first().scrollIntoView();
  cy.get('app-amount-selector select').first().select('fiat');
};

// Helper to select currency from the fiat selector dropdown
const selectCurrency = (currency: 'USD' | 'JPY') => {
  cy.get('app-fiat-selector').first().scrollIntoView();
  cy.get('app-fiat-selector').first().click();
  cy.get('app-fiat-selector select').first().select(currency);
};

describe('Fiat Currency Formatting', () => {

  if (baseModule === 'mempool') {

    describe('Dashboard', () => {
      beforeEach(() => {
        cy.visit('/');
        cy.waitForSkeletonGone();
        selectFiatMode();
        cy.get('.latest-transactions', { timeout: 10000 }).should('exist');
        cy.get('.table-cell-fiat', { timeout: 10000 }).should('have.length.at.least', 1);
      });

      describe('USD formatting', () => {
        beforeEach(() => {
          selectCurrency('USD');
        });

        it('displays USD values with correct currency symbol', () => {
          cy.get('.table-cell-fiat').eq(1).invoke('text').then((text) => {
            const trimmedText = text.trim();
            expect(trimmedText).to.include('$');
          });
        });

        it('displays USD values with proper decimal format', () => {
          cy.get('.table-cell-fiat').eq(1).invoke('text').then((text) => {
            const trimmedText = text.trim();
            expect(trimmedText).to.match(/^\$[\d,]+(\.\d{2})?$/);
          });
        });
      });

      describe('JPY formatting', () => {
        beforeEach(() => {
          selectCurrency('JPY');
          cy.get('.table-cell-fiat').eq(1).should(($el) => {
            expect($el.text()).to.include('¥');
          });
        });

        it('displays JPY values with yen symbol', () => {
          cy.get('.table-cell-fiat').eq(1).invoke('text').then((text) => {
            const trimmedText = text.trim();
            expect(trimmedText).to.include('¥');
          });
        });

        it('displays JPY values without decimal places', () => {
          cy.get('.table-cell-fiat').eq(1).invoke('text').then((text) => {
            const trimmedText = text.trim();
            expect(trimmedText).to.not.match(/\.\d+$/);
          });
        });

        it('formats all JPY values correctly without decimals', () => {
          cy.get('.table-cell-fiat').each(($el) => {
            const text = $el.text().trim();
            if (text.includes('¥')) {
              expect(text).to.not.match(/\.\d+/);
            }
          });
        });
      });

      describe('currency switching', () => {
        it('correctly formats when switching from USD to JPY', () => {
          selectCurrency('USD');
          cy.get('.table-cell-fiat').eq(1).invoke('text').then((usdText) => {
            expect(usdText.trim()).to.include('$');
          });

          selectCurrency('JPY');
          cy.get('.table-cell-fiat').eq(1).should(($el) => {
            const text = $el.text().trim();
            expect(text).to.include('¥');
            expect(text).to.not.match(/\.\d+$/);
          });
        });

        it('correctly formats when switching from JPY back to USD', () => {
          selectCurrency('JPY');
          cy.get('.table-cell-fiat').eq(1).should(($el) => {
            expect($el.text()).to.include('¥');
          });

          selectCurrency('USD');
          cy.get('.table-cell-fiat').eq(1).should(($el) => {
            expect($el.text().trim()).to.include('$');
          });
        });
      });
    });

    describe('Transaction Page', () => {
      beforeEach(() => {
        cy.visit('/tx/dd0faea1e9acd5bd812e5130c0912b62d6b63d04bac4558f2e07270ac613a8f2');
        cy.waitForSkeletonGone();
      });

      it('displays USD fiat values with dollar symbol', () => {
        selectCurrency('USD');
        selectFiatMode();

        cy.get('app-transaction-details .fiat').invoke('text').then((text) => {
          expect(text.trim()).to.include('$');
        });

        cy.get('app-transactions-list .fiat', { timeout: 10000 }).first().invoke('text').then((text) => {
          expect(text.trim()).to.include('$');
        });
      });

      it('displays JPY fiat values without decimals', () => {
        selectCurrency('JPY');
        selectFiatMode();


        cy.get('app-transaction-details .fiat').invoke('text').then((text) => {
          const trimmedText = text.trim();
          expect(trimmedText).to.include('¥');
          expect(trimmedText).to.not.match(/\.\d+/);
        });

        cy.get('app-transactions-list .fiat').first().should(($el) => {
          const text = $el.text().trim();
          expect(text).to.include('¥');
          expect(text).to.not.match(/\.\d+/);
        });
      });
    });

    describe('Block Page', () => {
      beforeEach(() => {
        cy.viewport(1080, 1920); // force taller screen to avoid scrollbars
        cy.intercept('/api/v1/blocks/0').as('blocks-0');
        cy.intercept('/api/v1/blocks/10').as('blocks-10');
        cy.intercept('/api/v1/blocks/20').as('blocks-20');
        cy.intercept('/api/txs/outspends*').as('outspends');
        cy.visit('/block/100000');
      });

      it('displays USD fiat values in block reward with dollar symbol', () => {
        cy.wait('@outspends').then(() => {
          cy.waitUntil(() => cy.get('.fiat').each(($el) => $el.is(':visible') && $el.text().trim().includes('$')));
          selectCurrency('USD');
          selectFiatMode();
          cy.get('.fiat').each(($el) => {
            expect($el.text().trim()).to.include('$');
          });
        });
      });
    
    it('displays JPY fiat values without decimals', () => {
        cy.wait('@outspends').then(() => {
          cy.waitUntil(() => cy.get('.fiat').each(($el) => $el.is(':visible') && $el.text().trim().includes('$')));
          selectCurrency('JPY');
          selectFiatMode();
          cy.get('.fiat').each(($el) => {
            expect($el.text().trim()).to.include('¥');
            expect($el.text().trim()).to.not.match(/\.\d+/);
          });
        });        
    })
  });
  
    describe('Address Page', () => {
      beforeEach(() => {
        cy.visit('/address/1wizaAB16Wrua9V58uNvqktyq2LBLtYso');
      });

      it('displays USD fiat values with dollar symbol', () => {
        selectCurrency('USD');
        selectFiatMode();
        cy.get('app-amount .fiat', { timeout: 10000 }).each(($el) => {
          expect($el.text().trim()).to.include('$');
        });
      });

      it('displays JPY fiat values without decimals', () => {
        selectCurrency('JPY');
        selectFiatMode();
        cy.get('app-amount .fiat').first().should(($el) => {
          const text = $el.text().trim();
          expect(text).to.include('¥');
          expect(text).to.not.match(/\.\d+/);
        });
      });
    });

    describe('Calculator Page', () => {
      beforeEach(() => {
        cy.visit('/tools/calculator');
        cy.waitForSkeletonGone();
        cy.get('input[formControlName="bitcoin"]', { timeout: 10000 }).should('be.visible');
      });

      it('displays USD price with dollar symbol', () => {
        selectCurrency('USD');
        cy.get('.symbol').invoke('text').then((text) => {
          expect(text.trim()).to.include('$');
        });
      });

      it('displays JPY price without decimals after switching currency', () => {
        selectCurrency('JPY');
        cy.get('.symbol').should(($el) => {
          const text = $el.text().trim();
          expect(text).to.include('¥');
        });

        // Enter a value in BTC to see the fiat conversion
        cy.get('input[formControlName="bitcoin"]').clear().type('1');

        // Check that the fiat output doesn't have decimals for JPY
        cy.get('input[formControlName="fiat"]').should(($el) => {
          const value = $el.val() as string;
          // JPY should not have decimal places in large values
          expect(value).to.not.match(/\.\d+$/);
        });
      });
    });

    describe('Mempool Block Tooltip', () => {
      beforeEach(() => {
        cy.visit('/');
        cy.waitForSkeletonGone();
        selectFiatMode();
      });

      it('displays USD fiat values in mempool block', () => {
        selectCurrency('USD');
        cy.get('#mempool-block-0').scrollIntoView();
        cy.get('#mempool-block-0').click();

        cy.waitForSkeletonGone();

        cy.get('app-mempool-block .fiat').each(($el) => {
          expect($el.text().trim()).to.include('$');
        });
      });

      it('displays JPY fiat values in mempool block', () => {
        selectCurrency('JPY');
        cy.get('#mempool-block-0').scrollIntoView();
        cy.get('#mempool-block-0').click();

        cy.waitForSkeletonGone();

        cy.get('app-mempool-block .fiat').invoke('text').then((text) => {
          expect(text.trim()).to.include('¥');
          expect(text).to.not.match(/\.\d+$/);
        });
      });
    });

  } else {
    it.skip(`Tests cannot be run on the selected BASE_MODULE ${baseModule}`);
  }
});
