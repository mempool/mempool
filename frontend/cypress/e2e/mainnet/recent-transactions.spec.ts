import { mockWebSocketV2, receiveWebSocketMessageFromServer } from '../../support/websocket';

const baseModule = Cypress.env('BASE_MODULE');

function randomHex(length: number): string {
  let result = '';
  const chars = '0123456789abcdef';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateMockTransactions(count: number): any[] {
  const txs = [];
  for (let i = 0; i < count; i++) {
    txs.push({
      txid: randomHex(64),
      fee: 1000 + Math.floor(Math.random() * 50000),
      vsize: 140 + Math.floor(Math.random() * 500),
      value: 10000 + Math.floor(Math.random() * 10000000),
    });
  }
  return txs;
}

function sendMockTransactions(count: number): string[] {
  const txs = generateMockTransactions(count);
  receiveWebSocketMessageFromServer({
    params: {
      message: {
        contents: JSON.stringify({ transactions: txs }),
      },
    },
  });
  return txs.map((tx) => tx.txid);
}

// Send init fixtures without waitForSkeletonGone (the /txs page has a
// skeleton row that only disappears once transactions fill the limit,
// which won't happen from mempool-info alone).
function initMempoolData(): void {
  cy.window({ timeout: 5000 })
    .should((win) => {
      expect(win.mockSocket).to.not.be.undefined;
    })
    .then((win) => {
      cy.readFile('cypress/fixtures/mainnet_live2hchart.json', 'utf-8').then((fixture) => {
        win.mockSocket.send(JSON.stringify(fixture));
      });
      cy.readFile('cypress/fixtures/mainnet_mempoolInfo.json', 'utf-8').then((fixture) => {
        win.mockSocket.send(JSON.stringify(fixture));
      });
    });
}

describe('Recent Transactions Page', () => {
  if (baseModule === 'mempool') {

    it('updates the transaction list over time', () => {
      mockWebSocketV2();
      cy.visit('/txs');
      initMempoolData();

      sendMockTransactions(6);
      cy.get('[data-cy="transactions-list"] tr').should('have.length.greaterThan', 0);

      const newTxids = sendMockTransactions(6);
      const markerTxid = newTxids[0].substring(0, 10);

      cy.get('[data-cy="transactions-list"] tr .table-cell-txid a').should(($rows) => {
        const visibleText = [...$rows].map((el) => el.textContent.trim()).join(' ');
        expect(visibleText).to.include(markerTxid);
      });
    });

    it('pauses updates when clicking the pause icon', () => {
      mockWebSocketV2();
      cy.visit('/txs');
      initMempoolData();

      sendMockTransactions(6);
      cy.get('[data-cy="transactions-list"] tr').should('have.length.greaterThan', 0);

      cy.get('[data-cy="btn-pause"]').click();

      cy.get('[data-cy="transactions-list"] tr .table-cell-txid a').then(($rows) => {
        const pausedTxids = [...$rows].map((el) => el.textContent.trim());

        const newTxids = sendMockTransactions(6);
        const markerTxid = newTxids[0].substring(0, 10);

        // The new txid should NOT appear in the list while paused
        cy.wait(1000);
        cy.get('[data-cy="transactions-list"] tr .table-cell-txid a').should(($updatedRows) => {
          const visibleText = [...$updatedRows].map((el) => el.textContent.trim()).join(' ');
          expect(visibleText).to.not.include(markerTxid);
          const updatedTxids = [...$updatedRows].map((el) => el.textContent.trim());
          expect(updatedTxids).to.deep.equal(pausedTxids);
        });
      });
    });

    it('caps the list when changing the limit to 10', () => {
      mockWebSocketV2();
      cy.visit('/txs');
      initMempoolData();

      // Send enough batches to fill 50 transactions (6 per batch, need 9 batches)
      for (let i = 0; i < 9; i++) {
        sendMockTransactions(6);
      }

      cy.get('[data-cy="transactions-list"] tr').should('have.length', 50);
      cy.get('[data-cy="limit-10"]').click();
      cy.scrollTo('top');
      cy.get('[data-cy="transactions-list"] tr').should('have.length', 10);
    });

    it('shows the new transaction pill when there are new transactions', () => {
      mockWebSocketV2();
      cy.visit('/txs');
      initMempoolData();

      sendMockTransactions(6);
      cy.get('[data-cy="transactions-list"] tr').should('have.length.greaterThan', 0);
      cy.scrollTo('bottom');
      // Ensure scroll event has fired and auto-pause is active
      cy.window().should((win) => {
        expect(win.scrollY).to.be.greaterThan(0);
      });

      sendMockTransactions(6);
      cy.get('[data-cy="new-tx-pill"]').should('be.visible');
    });

    it('shows the new transaction pill when there are new transactions and scrolls to the top when clicked', () => {
      mockWebSocketV2();
      cy.visit('/txs');
      initMempoolData();

      sendMockTransactions(6);
      cy.get('[data-cy="transactions-list"] tr').should('have.length.greaterThan', 0);
      cy.scrollTo('bottom');
      cy.window().should((win) => {
        expect(win.scrollY).to.be.greaterThan(0);
      });

      sendMockTransactions(6);
      cy.get('[data-cy="new-tx-pill"]').should('be.visible');
      cy.get('[data-cy="new-tx-pill"]').click();
      cy.wait(1000);
      cy.window().then((win) => {
        expect(win.scrollY).to.be.eq(0);
      });
    });
  }
});
