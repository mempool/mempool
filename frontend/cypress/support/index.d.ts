
/// <reference types="cypress" />
declare namespace Cypress {
    interface Chainable<Subject> {
        waitForSkeletonGone(): Chainable<any>
        waitForPageIdle(): Chainable<any>
        mockMempoolSocket(): Chainable<any>
        changeNetwork(network: "testnet"|"testnet4"|"signet"|"liquid"|"mainnet"): Chainable<any>
    }
}