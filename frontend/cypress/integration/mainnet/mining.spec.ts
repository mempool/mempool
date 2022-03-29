import { filter } from "cypress/types/bluebird";

const baseModule = Cypress.env("BASE_MODULE");

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
        cy.intercept('/api/tx/**').as('tx');
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
          cy.wait('@tx');
          cy.get('app-miner > .badge').click().then(() => {
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
        cy.get('[data-cy="mempool-block-0-transactions"]').invoke('text').should('match', /(.*) transactions/);
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

    describe('mining graphs', () => {
      describe('Pools ranking', () => {
        const filters = ['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'];
        it('loads the pools ranking graph', () => {
          cy.visit('/mining');
          cy.waitForSkeletonGone();
          cy.get('[data-cy="pool-distribution"] a').click().then(() => {
            cy.url().should('contain', '/graphs/mining/pools');
            cy.get('.container svg').find('text').then(($els) => {
              const pools = Cypress.$.makeArray($els).map((el) => el.textContent);
              pools.forEach((pool) => {
                expect(pool).to.match(/(\w+) \((.*)%\)/);
              });
            });
          });
        });

        it('updates the chart and tabular data when changing the date filters', () => {
          cy.intercept('/api/v1/mining/pools/**').as('pools');
          cy.intercept('/api/v1/blocks-extras').as('blocks-extras');
          cy.intercept('/api/v1/mining/reward-stats/144').as('reward-stats');

          const filters = ['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'].reverse();
          const tableContents = [];
          const minerDistribution = [];

          cy.visit('/mining');
          cy.waitForSkeletonGone();

          cy.wait('@blocks-extras');
          cy.wait('@pools');
          cy.wait('@reward-stats');

          cy.get('[data-cy="pool-distribution"] a').click();
          cy.url().should('contain', '/graphs/mining/pools');
          cy.waitForSkeletonGone();
          cy.wait('@pools', { timeout: 10000 }).then(() => {
            cy.wrap(filters).each((filter) => {
              cy.get(`[data-cy="${filter}"]`).click().then(() => {
                cy.get('.loadingGraphs');
                cy.wait('@pools', { timeout: 10000 });
                cy.get('.loadingGraphs').should('not.exist');

                cy.get('.container svg').find('text').then(($els) => {
                  const pools = Cypress.$.makeArray($els).map((el) => el.textContent);
                  minerDistribution.push(pools.join());
                  pools.forEach((pool) => {
                    expect(pool).to.match(/(\w+) \((.*)%\)/);
                  });
                });

                cy.get('[data-cy="pools-table"]').invoke('text').then(text => {
                  //TODO: use a proper waiter
                  cy.wait(500);
                  tableContents.push(text);
                });

              });
            });

          }).then(() => {
            let uniqueTableContents = Array.from(new Set(tableContents));
            expect(uniqueTableContents.length, "the table should show different data for each filter").to.eq(tableContents.length);

            let uniqueMinerContents = Array.from(new Set(minerDistribution));
            expect(uniqueMinerContents.length, "the miner distribution graph should show different data for each filter").to.eq(minerDistribution.length);
          });
        });

        describe('Pools dominance', () => {
          beforeEach(() => {
            cy.intercept('/api/v1/mining/hashrate/pools/**').as('pools-hashrate');
          });

          it('loads the pools dominance graph', () => {
            cy.visit('/graphs/mining/pools-dominance');
            cy.waitForSkeletonGone();
          });

          it.skip('updates the chart when changing the date filters', () => {
            cy.visit('/graphs/mining/pools-dominance');
            cy.waitForSkeletonGone();
            const filters = ['3m', '6m', '1y', '2y', '3y', 'all'].reverse();
            cy.wait('@pools-dominance', { timeout: 10000 }).then(() => {
              cy.wrap(filters).each((filter) => {
                cy.get(`[data-cy="${filter}"]`).click().then(() => {
                  cy.get('.loadingGraphs');
                  cy.wait('@pools-dominance', { timeout: 10000 });
                  cy.get('.loadingGraphs').should('not.exist');
                  cy.get('.full-container svg rect').then((rect) => {
                    console.log(rect);
                  });
                }).then(() => {
                  console.log("then");
                });
              });

            });
          });

          it.skip('updates the chart when toggling pools on and off', () => {
            cy.visit('/graphs/mining/pools-dominance');
            cy.waitForSkeletonGone();
          });
        });

        describe('Hashrate and difficulty', () => {
          beforeEach(() => {
            cy.intercept('/api/v1/mining/hashrate/**').as('hashrate');
          });

          it('loads the hashrate and difficulty graph', () => {
            cy.visit('/graphs/mining/hashrate-difficulty');
            cy.waitForSkeletonGone();
          });

          it('updates the chart when changing the date filters', () => {
            cy.visit('/graphs/mining/hashrate-difficulty');
            cy.waitForSkeletonGone();
            const filters = ['3m', '6m', '1y', '2y', '3y', 'all'];
            const hashrateContents = [];
            cy.wait('@hashrate', { timeout: 10000 }).then(() => {
              cy.wrap(filters).each((filter) => {
                cy.get(`[data-cy="${filter}"]`).click().then(() => {
                  cy.get('.loadingGraphs');
                  cy.wait('@hashrate', { timeout: 10000 });
                  cy.get('.loadingGraphs').should('not.exist');
                  // Get the raw line data for each data series in each filter
                  cy.get('svg g g').eq(0).find('path').invoke('attr', 'd').then((path) => {
                    hashrateContents.push(path);
                  });

                  cy.get('svg g g').eq(1).find('path').invoke('attr', 'd').then((path) => {
                    hashrateContents.push(path);
                  });
                });
              });
            }).then(() => {
              let uniqueHashratePaths = Array.from(new Set(hashrateContents));
              expect(uniqueHashratePaths.length, "the hashrate lines should show different data for each filter").to.eq(hashrateContents.length);
            });
          });

          it.skip('updates the chart when toggling hashrate and difficulty on and off', () => {
            cy.visit('/graphs/mining/hashrate-difficulty');
            cy.waitForSkeletonGone();
            cy.wait('@hashrate', { timeout: 10000 }).then(() => {

            });
          });
        });

      });
    })
  } else {
    it.skip(`Tests cannot be run on the selected BASE_MODULE ${baseModule}`);
  }
});
