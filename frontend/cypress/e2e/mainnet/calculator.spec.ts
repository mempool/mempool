import { emitMempoolInfo, receiveWebSocketMessageFromServer } from '../../support/websocket';

const calculatorBaseModule = Cypress.env('BASE_MODULE');

const MOCK_BTC_PRICE_USD = 123456;
const MOCK_BTC_PRICE_JPY = 11057757;

describe('Calculator', () => {
  beforeEach(() => {
    cy.mockMempoolSocketV2();
    cy.visit('/tools/calculator');

    emitMempoolInfo({
      params: {
        command: 'init',
        waitForMempoolBlocks: false
      }
    });

    cy.get('input[formControlName="bitcoin"]', { timeout: 15000 }).should('be.visible');

    receiveWebSocketMessageFromServer({
      params: {
        message: {
          contents: `{"conversions": { "time": 1770429602, "USD": ${MOCK_BTC_PRICE_USD}, "EUR": 59711, "GBP": 51810, "CAD": 96567, "CHF": 54834, "AUD": 100897, "JPY": ${MOCK_BTC_PRICE_JPY} }}`
        }
      }
    });

    cy.get('.symbol', { timeout: 10000 }).should(($el) => {
      expect($el.text().replace(/,/g, '')).to.include(String(MOCK_BTC_PRICE_USD));
    });
  });

  if (calculatorBaseModule === 'mempool') {

    describe('page load and initial state', () => {
      it('loads the calculator page with heading and form', () => {
        cy.get('h2').should('contain', 'Calculator');
        cy.contains('Waiting for price feed...').should('not.exist');
        cy.get('input[formControlName="fiat"]').should('be.visible');
        cy.get('input[formControlName="bitcoin"]').should('be.visible');
        cy.get('input[formControlName="satoshis"]').should('be.visible');
      });

      it('displays the mocked conversion rate in .symbol', () => {
        cy.get('.symbol').invoke('text').then((text) => {
          expect(text.replace(/,/g, '')).to.include(String(MOCK_BTC_PRICE_USD));
        });
      });

      it('shows copy buttons for each input', () => {
        cy.get('app-clipboard').should('have.length', 3);
        cy.get('app-clipboard').each(($el) => {
          cy.wrap($el).should('be.visible');
        });
      });

      it('shows fiat price display and bitcoin visual', () => {
        cy.contains('Fiat price last updated').should('be.visible');
        cy.get('.bitcoin-satoshis-text').should('be.visible');
        cy.get('.bitcoin-satoshis-text').should('contain', '₿');
        cy.get('.fiat-text').should('be.visible');
      });

      it('shows input labels for currency, BTC, and sats', () => {
        cy.get('.input-group-text').contains('BTC').should('be.visible');
        cy.get('.input-group-text').contains('sats').should('be.visible');
      });
    });

    describe('default values', () => {
      it('displays 1 BTC with correct sats and fiat', () => {
        cy.get('input[formControlName="bitcoin"]').invoke('val').then((btcVal) => {
          expect(parseFloat(String(btcVal))).to.equal(1);
        });
        cy.get('input[formControlName="satoshis"]').invoke('val').should('equal', '100000000');
        cy.get('input[formControlName="fiat"]').invoke('val').then((fiatVal) => {
          const fiat = parseFloat(String(fiatVal).replace(/,/g, ''));
          expect(fiat).to.equal(MOCK_BTC_PRICE_USD);
        });
      });
    });

    describe('bitcoin input updates fiat and sats', () => {
      it('updates fiat and sats when entering 0.5 BTC', () => {
        const expectedFiat = Math.round(MOCK_BTC_PRICE_USD * 0.5 * 100) / 100;
        cy.get('input[formControlName="bitcoin"]').clear().type('0.5');
        cy.get('input[formControlName="satoshis"]').invoke('val').should('equal', '50000000');
        cy.get('input[formControlName="fiat"]').invoke('val').then((fiatVal) => {
          const fiat = parseFloat(String(fiatVal).replace(/,/g, ''));
          expect(fiat).to.equal(expectedFiat);
        });
      });

      it('updates fiat and sats when entering 1 sat (0.00000001 BTC)', () => {
        const expectedFiat = (MOCK_BTC_PRICE_USD / 100_000_000 * 100 / 100).toFixed(8);
        cy.get('input[formControlName="bitcoin"]').clear().type('0.00000001');
        cy.get('input[formControlName="satoshis"]').invoke('val').should('equal', '1');
        cy.get('input[formControlName="fiat"]').invoke('val').then((fiatVal) => {
          expect(String(fiatVal)).to.equal(expectedFiat);
        });
      });
    });

    describe('fiat input updates BTC and sats', () => {
      it('updates BTC and sats when entering fiat value', () => {
        const fiatAmount = 100;
        const expectedBtc = parseFloat((fiatAmount / MOCK_BTC_PRICE_USD).toFixed(8));
        const expectedSats = Math.round((fiatAmount / MOCK_BTC_PRICE_USD) * 100_000_000);
        cy.get('input[formControlName="fiat"]').clear().type(String(fiatAmount));
        cy.get('input[formControlName="bitcoin"]').invoke('val').then((btcVal) => {
          expect(parseFloat(String(btcVal))).to.equal(expectedBtc);
        });
        cy.get('input[formControlName="satoshis"]').invoke('val').then((satsVal) => {
          expect(parseInt(String(satsVal), 10)).to.equal(expectedSats);
        });
      });
    });

    describe('satoshis input updates BTC and fiat', () => {
      it('updates BTC and fiat when entering 10000 sats', () => {
        const satsAmount = 10000;
        const expectedFiat = Math.round((satsAmount / 100_000_000) * MOCK_BTC_PRICE_USD * 100) / 100;
        cy.get('input[formControlName="satoshis"]').clear().type(String(satsAmount));
        cy.get('input[formControlName="bitcoin"]').invoke('val').should('equal', '0.00010000');
        cy.get('input[formControlName="fiat"]').invoke('val').then((fiatVal) => {
          const fiat = parseFloat(String(fiatVal).replace(/,/g, ''));
          expect(fiat).to.equal(expectedFiat);
        });
      });
    });

    describe('input sanitization', () => {
      it('normalizes comma to dot in fiat input', () => {
        cy.get('input[formControlName="fiat"]').clear().type('1,5');
        cy.get('input[formControlName="fiat"]').invoke('val').then((val) => {
          expect(String(val)).to.match(/^1\.5/);
        });
      });

      it('limits BTC to 8 decimals', () => {
        cy.get('input[formControlName="bitcoin"]').clear().type('1.123456789');
        cy.get('input[formControlName="bitcoin"]').invoke('val').then((val) => {
          const parts = String(val).split('.');
          expect(parts.length).to.be.lte(2);
          if (parts[1]) {
            expect(parts[1].length).to.be.lte(8);
          }
        });
      });

      it('strips decimals from satoshis input', () => {
        cy.get('input[formControlName="satoshis"]').clear().type('10000.99');
        cy.get('input[formControlName="satoshis"]').invoke('val').then((val) => {
          expect(String(val)).not.to.include('.');
        });
      });
    });

    describe('max supply (21M BTC)', () => {
      it('shows warning when entering 21M BTC', () => {
        cy.get('input[formControlName="bitcoin"]').clear().type('21000000');
        cy.get('.alert.alert-warning').should('be.visible');
        cy.get('.alert.alert-warning').should('contain', 'Values were capped at the max supply of 21M BTC');
        cy.get('input[formControlName="bitcoin"]').invoke('val').should('equal', '21000000');
        cy.get('input[formControlName="satoshis"]').invoke('val').should('equal', '2100000000000000');
      });

      it('caps values at max supply', () => {
        cy.get('input[formControlName="bitcoin"]').clear().type('25000000');
        cy.get('.alert.alert-warning').should('be.visible');
        cy.get('input[formControlName="bitcoin"]').invoke('val').should('equal', '21000000');
      });
    });

    describe('clipboard buttons', () => {
      it('copy buttons exist and are visible', () => {
        cy.get('app-clipboard').should('have.length', 3);
        cy.get('app-clipboard button, app-clipboard .btn').each(($btn) => {
          cy.wrap($btn).should('be.visible');
        });
      });
    });

    describe('responsive viewports', () => {
      it('calculator is usable on desktop', () => {
        cy.viewport('macbook-16');
        cy.get('input[formControlName="bitcoin"]').should('be.visible');
        cy.get('input[formControlName="bitcoin"]').clear().type('1');
        cy.get('input[formControlName="bitcoin"]').invoke('val').should('include', '1');
      });

      it('calculator is usable on mobile', () => {
        cy.viewport('iphone-6');
        cy.get('input[formControlName="bitcoin"]').should('be.visible');
        cy.get('input[formControlName="fiat"]').should('be.visible');
        cy.get('input[formControlName="satoshis"]').should('be.visible');
      });
    });

    describe('loading state', () => {
      it('shows calculator form after price feed loads', () => {
        cy.contains('Waiting for price feed...').should('not.exist');
        cy.get('input[formControlName="bitcoin"]').should('be.visible');
      });
    });

    describe('JPY currency', () => {
      beforeEach(() => {
        cy.get('app-fiat-selector').scrollIntoView();
        cy.get('app-fiat-selector select').select('JPY');
        cy.get('.symbol', { timeout: 10000 }).should(($el) => {
          expect($el.text().replace(/,/g, '')).to.include(String(MOCK_BTC_PRICE_JPY));
        });
    
      });

      it('displays JPY conversion rate in .symbol', () => {
        cy.get('.symbol').invoke('text').then((text) => {
          expect(text.replace(/,/g, '')).to.include(String(MOCK_BTC_PRICE_JPY));
        });
      });

      it('displays 1 BTC with correct sats and fiat in JPY', () => {
        cy.get('input[formControlName="bitcoin"]').invoke('val').then((btcVal) => {
          expect(parseFloat(String(btcVal))).to.equal(1);
        });
        cy.get('input[formControlName="satoshis"]').invoke('val').should('equal', '100000000');
        cy.get('input[formControlName="fiat"]').invoke('val').then((fiatVal) => {
          const fiat = parseFloat(String(fiatVal).replace(/,/g, ''));
          expect(fiat).to.equal(MOCK_BTC_PRICE_JPY);
        });
      });

      it('updates fiat and sats when entering 0.5 BTC in JPY', () => {
        const expectedFiat = Math.round(MOCK_BTC_PRICE_JPY * 0.5 * 100) / 100;
        cy.get('input[formControlName="bitcoin"]').clear().type('0.5');
        cy.get('input[formControlName="satoshis"]').invoke('val').should('equal', '50000000');
        cy.get('input[formControlName="fiat"]').invoke('val').then((fiatVal) => {
          const fiat = parseFloat(String(fiatVal).replace(/,/g, ''));
          expect(fiat).to.equal(expectedFiat);
        });
      });

      it('updates BTC and sats when entering fiat value in JPY', () => {
        const fiatAmount = 1000000;
        const expectedBtc = parseFloat((fiatAmount / MOCK_BTC_PRICE_JPY).toFixed(8));
        const expectedSats = Math.round((fiatAmount / MOCK_BTC_PRICE_JPY) * 100_000_000);
        cy.get('input[formControlName="fiat"]').clear().type(String(fiatAmount));
        cy.get('input[formControlName="bitcoin"]').invoke('val').then((btcVal) => {
          expect(parseFloat(String(btcVal))).to.equal(expectedBtc);
        });
        cy.get('input[formControlName="satoshis"]').invoke('val').then((satsVal) => {
          expect(parseInt(String(satsVal), 10)).to.equal(expectedSats);
        });
      });

      it('updates BTC and fiat when entering 10000 sats in JPY', () => {
        const satsAmount = 10000;
        const expectedFiat = Math.round((satsAmount / 100_000_000) * MOCK_BTC_PRICE_JPY * 100) / 100;
        cy.get('input[formControlName="satoshis"]').clear().type(String(satsAmount));
        cy.get('input[formControlName="bitcoin"]').invoke('val').should('equal', '0.00010000');
        cy.get('input[formControlName="fiat"]').invoke('val').then((fiatVal) => {
          const fiat = parseFloat(String(fiatVal).replace(/,/g, ''));
          expect(fiat).to.equal(expectedFiat);
        });
      });
    });

  } else {
    it.skip(`Tests cannot be run on the selected BASE_MODULE ${calculatorBaseModule}`);
  }
});
