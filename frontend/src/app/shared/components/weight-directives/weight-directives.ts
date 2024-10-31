import { Directive, OnDestroy, TemplateRef, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';

function createRateUnitDirective(checkFn: (rateUnit: string) => boolean): any {
  @Directive()
  class RateUnitDirective implements OnDestroy {
    private subscription: Subscription;
    private enabled: boolean;
    private hasView: boolean = false;

    constructor(
      private templateRef: TemplateRef<any>,
      private viewContainer: ViewContainerRef,
      private stateService: StateService
    ) {
      this.subscription = this.stateService.rateUnits$.subscribe(rateUnit => {
        this.enabled = checkFn(rateUnit);
        this.updateView();
      });
    }

    updateView(): void {
      if (this.enabled && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!this.enabled && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    }

    ngOnDestroy(): void {
      this.subscription.unsubscribe();
    }
  }

  return RateUnitDirective;
}

@Directive({ selector: '[only-vsize]' })
export class OnlyVsizeDirective extends createRateUnitDirective(rateUnit => rateUnit !== 'wu') {}

@Directive({ selector: '[only-weight]' })
export class OnlyWeightDirective extends createRateUnitDirective(rateUnit => rateUnit === 'wu') {}
