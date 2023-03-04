const baseModule = Cypress.env('BASE_MODULE');

describe('Mainnet - Mining Features', () => {
  beforeEach(() => {
    //https://github.com/cypress-io/cypress/issues/14459
    if (Cypress.browser.family === 'chromium') {
      Cypress.automation('remote:debugger:protocol', {
        command: 'Network.enable',
        params: {}
      });
      Cypress.automation('remote:debugger:protocol', {
        command: 'Network.setCacheDisabled',
        params: { cacheDisabled: true }
      });
    }
  });

  if (baseModule === 'mempool') {

    describe('Miner page', () => {
      beforeEach(() => {
        cy.intercept('/api/v1/mining/pool/**').as('pool');
        cy.intercept('/api/v1/mining/hashrate/pools/**').as('hashrate');
        cy.intercept('/api/tx/**').as('tx');
        cy.intercept('/api/v1/outpends/**').as('outspends');
      });
      it('loads the mining pool page from the dashboard', () => {
        cy.visit('/mining');
        cy.waitForSkeletonGone();
        cy.get('[data-cy="bitcoin-block-0-pool"]').click().then(() => {
          cy.waitForSkeletonGone();
          cy.wait('@pool');
          cy.url().should('match', /\/mining\/pool\/(\w+)/);
        });
      });

      it('loads the mining pool page from the blocks page', () => {
        cy.visit('/mining');
        cy.waitForSkeletonGone();
        cy.get('[data-cy="bitcoin-block-0-height"]').click().then(() => {
          cy.waitForSkeletonGone();
          cy.get('[data-cy="block-details-miner-badge"]').click().then(() => {
            cy.waitForSkeletonGone();
            cy.wait('@pool');
            cy.url().should('match', /\/mining\/pool\/(\w+)/);
          });
        });
      });
    });

    describe('Mining Dashboard Landing page widgets', () => {

      beforeEach(() => {
        cy.visit('/mining');
        cy.waitForSkeletonGone();
      });

      it('shows the mempool blocks', () => {
        cy.get('[data-cy="mempool-block-0-fees"]').invoke('text').should('match', /~(.*) sat\/vB/);
        cy.get('[data-cy="mempool-block-0-fee-span"]').invoke('text').should('match', /(.*) - (.*) sat\/vB/);
        cy.get('[data-cy="mempool-block-0-total-fees"]').invoke('text').should('match', /(.*) BTC/);
        cy.get('[data-cy="mempool-block-0-transaction-count"]').invoke('text').should('match', /(.*) transactions/);
        cy.get('[data-cy="mempool-block-0-time"]').invoke('text').should('match', /In ~(.*) minutes/);
      });

      it('shows the mined blocks', () => {
        cy.get('[data-cy="bitcoin-block-0-height"]').invoke('text').should('match', /(\d)/);
        cy.get('[data-cy="bitcoin-block-0-fees"]').invoke('text').should('match', /~(.*) sat\/vB/);
        cy.get('[data-cy="bitcoin-block-0-fee-span"]').invoke('text').should('match', /(.*) - (.*) sat\/vB/);
        cy.get('[data-cy="bitcoin-block-0-total-fees"]').invoke('text').should('match', /(.*) BTC/);
        cy.get('[data-cy="bitcoin-block-0-transactions"]').invoke('text').should('match', /(.*) transactions/);
        cy.get('[data-cy="bitcoin-block-0-time"]').invoke('text').should('match', /((.*) ago|Just now)/);
        cy.get('[data-cy="bitcoin-block-0-pool"]').invoke('text').should('match', /(\w)/);
      });

      it('shows the reward stats for the last 144 blocks', () => {
        cy.get('[data-cy="reward-stats"]');
      });

      it('shows the difficulty adjustment stats', () => {
        cy.get('[data-cy="difficulty-adjustment"]');
      });

      it('shows the latest blocks', () => {
        cy.get('[data-cy="latest-blocks"]');
      });

      it('shows the pools pie chart', () => {
        cy.get('[data-cy="pool-distribution"]');
      });

      it('shows the hashrate graph', () => {
        cy.get('[data-cy="hashrate-graph"]');
      });
      it('shows the latest blocks', () => {
        cy.get('[data-cy="latest-blocks"]');
      });

      it('shows the latest adjustments', () => {
        cy.get('[data-cy="difficulty-adjustments-table"]');
      });
    });

    describe.only('mining graphs', () => {
      describe('pools ranking', () => {
        it('loads the graph', () => {
          cy.visit('/graphs/mining/pools');
          cy.waitForSkeletonGone();
          cy.waitForPageIdle();
          cy.get('.spinner-border').should('not.exist');
        });
      });

      describe('pools dominance', () => {
        it('loads the graph', () => {
          cy.visit('/graphs/mining/pools-dominance');
          cy.waitForSkeletonGone();
          cy.waitForPageIdle();
          cy.get('.spinner-border').should('not.exist');
        });
      });

      describe('hashrate & difficulty', () => {
        it('loads the graph', () => {
          cy.visit('/graphs/mining/hashrate-difficulty');
          cy.waitForSkeletonGone();
          cy.waitForPageIdle();
          cy.get('.spinner-border').should('not.exist');
        });
      });

      describe('block fee rates', () => {
        it('loads the graph', () => {
          cy.visit('/graphs/mining/block-fee-rates');
          cy.waitForSkeletonGone();
          cy.waitForPageIdle();
          cy.get('.spinner-border').should('not.exist');
        });
      });

      describe('block fees', () => {
        it('loads the graph', () => {
          cy.visit('/graphs/mining/block-fees');
          cy.waitForSkeletonGone();
          cy.waitForPageIdle();
          cy.get('.spinner-border').should('not.exist');
        });
      });

      describe('block rewards', () => {
        it('loads the graph', () => {
          cy.visit('/graphs/mining/block-rewards');
          cy.waitForSkeletonGone();
          cy.waitForPageIdle();
          cy.get('.spinner-border').should('not.exist');
        });
      });

      describe('block sizes and weights', () => {
        it('loads the graph', () => {
          cy.visit('/graphs/mining/block-sizes-weights');
          cy.waitForSkeletonGone();
          cy.waitForPageIdle();
          cy.get('.spinner-border').should('not.exist');
        });
      });
    });
  } else {
    it.skip(`Tests cannot be run on the selected BASE_MODULE ${baseModule}`);
  }
});
