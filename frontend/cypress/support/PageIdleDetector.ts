// source: chrisp_68 @ https://stackoverflow.com/questions/50525143/how-do-you-reliably-wait-for-page-idle-in-cypress-io-test
export class PageIdleDetector
{   
    defaultOptions: Object = { timeout: 60000 };

    public WaitForPageToBeIdle(): void
    {
        this.WaitForPageToLoad();
        this.WaitForAngularRequestsToComplete();
        this.WaitForAngularDigestCycleToComplete();
        this.WaitForAnimationsToStop();
    }

    public WaitForPageToLoad(options: Object = this.defaultOptions): void
    {
        cy.document(options).should((myDocument: any) =>
        {
            expect(myDocument.readyState, "WaitForPageToLoad").to.be.oneOf(["interactive", "complete"]);
        });
    }

    public WaitForAngularRequestsToComplete(options: Object = this.defaultOptions): void
    {
        cy.window(options).should((myWindow: any) =>
        {
            if (!!myWindow.angular)
            {
                expect(this.NumberOfPendingAngularRequests(myWindow), "WaitForAngularRequestsToComplete").to.have.length(0);
            }
        });
    }

    public WaitForAngularDigestCycleToComplete(options: Object = this.defaultOptions): void
    {
        cy.window(options).should((myWindow: any) =>
        {
            if (!!myWindow.angular)
            {
                expect(this.AngularRootScopePhase(myWindow), "WaitForAngularDigestCycleToComplete").to.be.null;
            }
        });
    }

    public WaitForAnimationsToStop(options: Object = this.defaultOptions): void
    {
        cy.get(":animated", options).should("not.exist");
    }

    private getInjector(myWindow: any)
    {
        return myWindow.angular.element(myWindow.document.body).injector();
    }

    private NumberOfPendingAngularRequests(myWindow: any)
    {
        return this.getInjector(myWindow).get('$http').pendingRequests;
    }

    private AngularRootScopePhase(myWindow: any)
    {
        return this.getInjector(myWindow).get("$rootScope").$$phase;
    }
}
