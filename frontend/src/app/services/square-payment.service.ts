import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ServicesApiServices } from '@app/services/services-api.service';
import { log } from '@app/shared/logger.utils';

type SquarePaymentMethod = 'googlePay' | 'applePay' | 'cashApp' | 'cardOnFile';
type SquareCallbackEvent = 'ready' | 'loading' | 'updating' | 'error' | 'cashAppTokenized' | 'googlePayClicked' | 'applePayClicked';
type SquareLifecycleStep =
  | 'start'
  // setup
  | 'loading_sdk'
  | 'setting_up_payments'
  | 'payments_ready'
  | 'waiting_to_update'
  | 'updating_methods'
  // ready
  | 'ready'
  // cleanup
  | 'waiting_to_cleanup'
  | 'cleaning_up'
type SquareLifecycleStage = 'start' | 'setup' | 'update' | 'updatenow' | 'ready' | 'cleanup';

export interface SquareInitConfig {
  availableMethods: {
    googlePay: boolean;
    applePay: boolean;
    cashApp: boolean;
  };
  txid: string;
  costUSD: number;
}

@Injectable({ providedIn: 'root' })
export class SquarePaymentService {
  private currentStage: SquareLifecycleStage = 'start';
  private currentStep: SquareLifecycleStep = 'start';
  private nextStage: 'setup' | 'cleanup' | 'update' | 'updatenow' | null = null;

  private fresh = true;
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private updateResolver: ((value: void | PromiseLike<void>) => void) | null = null;
  private cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private cleanupResolver: ((value: void | PromiseLike<void>) => void) | null = null;

  private payments: any = null;
  private googlePay: any = null;
  private applePay: any = null;
  private cashAppPay: any = null;
  private googlePayRequest: any = null;
  private applePayRequest: any = null;
  private cashAppPayRequest: any = null;

  private config: SquareInitConfig | null = null;
  private newConfig: SquareInitConfig | null = null;

  private callbacks: Partial<Record<SquareCallbackEvent, Function>> = {};
  private attachedMethods: { googlePay: boolean, applePay: boolean, cashApp: boolean } = { googlePay: false, applePay: false, cashApp: false };

  constructor(private servicesApiService: ServicesApiServices) {}

  async init(): Promise<void> {
    await this.requestStage('setup');
  }

  async update(config: SquareInitConfig, now = false): Promise<void> {
    log('[SquarePayment] Updating with config:', config);
    await this.requestStage(now ? 'updatenow' : 'update', config);
  }

  async cleanup(): Promise<void> {
    await this.requestStage('cleanup');
  }

  private async requestStage(stage: 'setup' | 'update' | 'updatenow' | 'cleanup', config?: SquareInitConfig): Promise<void> {
    log('[SquarePayment] Requesting stage:', stage);
    this.newConfig = config;
    switch (stage) {
      case 'setup':
        switch (this.currentStage) {
          case 'start':
            await this.executeStage('setup');
            break;
          case 'setup':
          case 'update':
          case 'updatenow':
          case 'ready':
            // already setup or setting up
            this.nextStage = null;
            break;
          case 'cleanup':
            this.nextStage = 'setup';
            this.cancelCleanup();
            break;
        }
        break;
      case 'update':
      case 'updatenow': {
        const updateStage = stage as 'update' | 'updatenow';
        switch (this.currentStage) {
          case 'start':
          case 'setup':
            if (this.currentStep === 'payments_ready') {
              this.executeStage(updateStage);
            } else {
              log('[SquarePayment] Setting next stage to update (currently )...', this.currentStage);
              this.nextStage = updateStage;
            }
            break;
            case 'update':
            case 'updatenow':
              this.nextStage = updateStage;
              if (this.currentStep === 'waiting_to_update') {
                log('[SquarePayment] Cancelling queued update...');
                // haven't actually started updating yet, so we can just cancel the timer, resolve the previous update early, and try again
                this.cancelUpdate();
              }
              break;
          case 'ready':
            await this.executeStage(updateStage);
            break;
        }
      } break;
      case 'cleanup':
        switch (this.currentStage) {
          case 'setup':
            this.nextStage = 'cleanup';
            break;
          case 'update':
          case 'updatenow':
            this.nextStage = 'cleanup';
            await this.cancelUpdate();
            break;
          case 'ready':
            await this.executeStage('cleanup');
            break;
        }
        break;
    }
  }

  private async executeStage(stage: 'setup' | 'update' | 'updatenow' | 'cleanup'): Promise<void> {
    log('[SquarePayment] Executing stage:', stage);
    switch (stage) {
      case 'setup':
        await this.startSetup();
        break;
      case 'update':
        await this.startUpdate();
        break;
      case 'updatenow':
        await this.startUpdate(true);
        break;
      case 'cleanup':
        await this.startCleanup();
        break;
    }
    if (this.nextStage) {
      log('[SquarePayment] Moving to next stage:', this.nextStage);
      const stage = this.nextStage;
      this.nextStage = null;
      await this.executeStage(stage);
    }
  }

  private async startSetup(): Promise<void> {
    this.fresh = true;
    this.emitCallback('loading');
    this.currentStage = 'setup';
    this.currentStep = 'loading_sdk';
    await this.loadSquareSdk();
    this.currentStep = 'setting_up_payments';
    await this.setupPayments();
    this.currentStep = 'payments_ready';
  }

  private async startUpdate(now = false): Promise<void> {
    log('[SquarePayment] Starting an update...');
    this.currentStage = 'update';
    this.currentStep = 'waiting_to_update';
    clearTimeout(this.updateTimer);
    this.emitCallback('loading');
    this.fresh = false;
    if (now) {
      log('[SquarePayment] Running update immediately...');
          this.currentStep = 'updating_methods';
          const successfulMethods = await this.updatePaymentMethods();
          this.emitCallback('ready', successfulMethods);
          this.currentStep = 'ready';
          this.currentStage = 'ready';
    } else {
      // wait for 2 seconds to debounce frequent updates
      log('[SquarePayment] Queueing update...');
      await new Promise<void>((resolve) => {
        this.updateResolver = resolve;
        this.updateTimer = setTimeout(async () => {
          log('[SquarePayment] Running queued update...');
          this.currentStep = 'updating_methods';
          const successfulMethods = await this.updatePaymentMethods();
          this.emitCallback('ready', successfulMethods);
          this.currentStep = 'ready';
          this.currentStage = 'ready';
          this.updateResolver = null;
          resolve();
        }, 2000);
      });
    }
    log('[SquarePayment] Update finished');
  }

  private cancelUpdate(): void {
    log('[SquarePayment] Cancelling queued update...');
    const resolve = this.updateResolver;
    this.updateResolver = null;
    clearTimeout(this.updateTimer);
    if (resolve) {
      resolve();
    }
  }

  private async startCleanup(): Promise<void> {
    log('[SquarePayment] Queueing a cleanup...');
    this.currentStage = 'cleanup';

    this.detachMethods();

    this.currentStep = 'waiting_to_cleanup';
    clearTimeout(this.cleanupTimer);
    await new Promise<void>((resolve) => {
      this.cleanupResolver = resolve;
      this.cleanupTimer = setTimeout(async () => {
        log('[SquarePayment] Running queued cleanup...');
        this.currentStep = 'cleaning_up';
        await Promise.all([
          this.cleanupMethods(),
          this.cleanupPaymentsAndIframes(),
        ]);
        this.currentStep = 'start';
        this.currentStage = 'start';
        this.cleanupResolver = null;
        resolve();
      }, 30000);
    });
    log('[SquarePayment] Cleanup finished');
  }

  private cancelCleanup(): void {
    log('[SquarePayment] Cancelling queued cleanup...');
    const resolve = this.cleanupResolver;
    this.cleanupResolver = null;
    clearTimeout(this.cleanupTimer);
    if (resolve) {
      resolve();
    }
  }

  registerCallback(event: SquareCallbackEvent, callback: Function): void {
    this.callbacks[event] = callback;
  }

  unregisterCallback(event: SquareCallbackEvent): void {
    delete this.callbacks[event];
  }

  unregisterAllCallbacks(): void {
    this.callbacks = {};
  }

  private emitCallback(event: SquareCallbackEvent, ...args: any[]): void {
    const callback = this.callbacks[event];
    if (callback) {
      callback(...args);
    }
  }

  private async loadSquareSdk(): Promise<void> {
    log('[SquarePayment] Loading Square SDK...');

    if (window['Square']) {
      log('[SquarePayment] Square SDK already loaded');
      return;
    }

    const isProd = document.location.hostname === 'mempool.space';
    const scriptUrl = isProd
      ? '/square/v1/square.js'
      : 'https://sandbox.web.squarecdn.com/v1/square.js';

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Square SDK'));
      document.head.appendChild(script);
    });

    await this.waitFor(() => !!window['Square'], 10000);
    log('[SquarePayment] Square SDK loaded');
  }

  private async setupPayments(): Promise<void> {
    log('[SquarePayment] Setting up payments...');

    const setupResult = await firstValueFrom(this.servicesApiService.setupSquare$());
    if (!setupResult) {
      throw new Error('Failed to get Square setup configuration');
    }
    const { squareAppId, squareLocationId } = setupResult;

    this.payments = window['Square'].payments(squareAppId, squareLocationId);
    log('[SquarePayment] Payments object created', this.payments);
  }

  private async updatePaymentMethods(): Promise<string[]> {
    if (!this.payments || !this.newConfig) {
      log('[SquarePayment] No payments object or config, skipping method initialization');
      return;
    }
    log('[SquarePayment] Initializing payment methods...');

    const txidChanged = this.newConfig.txid !== this.config?.txid;
    this.config = this.newConfig;

    const promises: Promise<string | void>[] = [
      this.config?.availableMethods.googlePay ? this.updateGooglePay(txidChanged).then(() => 'googlepay') : this.removeGooglePay(),
      this.config?.availableMethods.applePay ? this.updateApplePay(txidChanged).then(() => 'applepay') : this.removeApplePay(),
      this.config?.availableMethods.cashApp ? this.updateCashApp().then(() => 'cashapp') : this.removeCashApp(),
    ];

    const results = await Promise.allSettled(promises);
    return results.map(result => result.status === 'fulfilled' ? result.value : null).filter(Boolean) as string[];
  }

  private async updateGooglePay(txidChanged: boolean): Promise<void> {
    log('[SquarePayment] Updating Google Pay...');
    if (!this.googlePay || txidChanged) {
      this.removeGooglePay();
      log('[SquarePayment] Creating Google Pay request...');
      try {
        this.googlePayRequest = this.payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: { amount: this.config.costUSD.toFixed(2), label: 'Total' },
        });
        this.googlePay = await Promise.race([
          this.payments.googlePay(this.googlePayRequest, {
            referenceId: this.buildReferenceId(),
          }),
          this.timeout(8000)
        ]);
        if (!this.googlePay) {
          throw new Error('Google Pay request timed out');
        }
        log('[SquarePayment] Google Pay request created', this.googlePayRequest);
      } catch (e) {
        console.error('[SquarePayment] Google Pay init failed:', e);
        this.googlePay = null;
        this.googlePayRequest = null;
        throw e;
      }
    } else {
      log(`[SquarePayment] Updating Google Pay amount`, this.googlePayRequest);
      try {
        this.googlePayRequest.update({ total: { amount: this.config.costUSD.toFixed(2), label: 'Total' } });
      } catch (e) {
        console.error('[SquarePayment] Google Pay amount update failed:', e);
        throw e;
      }
    }
    if (!this.attachedMethods.googlePay) {
      try {
        const button = await this.waitForElementById('google-pay-button');
        await this.googlePay.attach(`#google-pay-button`, {
          buttonType: 'pay',
          buttonSizeMode: 'fill',
        });
        button.addEventListener('click', event => {
          this.emitCallback('googlePayClicked', event, this.googlePay, this.config);
        });
        this.attachedMethods.googlePay = true;
      } catch (e) {
        console.error('[SquarePayment] Google Pay attach failed:', e);
        this.googlePay = null;
        this.googlePayRequest = null;
        throw e;
      }
    }
  }

  private async removeGooglePay(): Promise<void> {
    if (this.googlePay) {
      try {
        if (this.attachedMethods.googlePay) {
          this.googlePay.detach();
          this.attachedMethods.googlePay = false;
        }
        this.googlePay.destroy();
      } catch (e) {
        console.error('[SquarePayment] Google Pay destroy failed:', e);
      } finally {
        this.googlePay = null;
        this.googlePayRequest = null;
      }
    }
  }

  private async updateApplePay(txidChanged: boolean): Promise<void> {
    log('[SquarePayment] Updating Apple Pay...');
    if (!this.applePay || txidChanged) {
      this.removeApplePay();
      log('[SquarePayment] Creating Apple Pay request...');
      try {
        this.applePayRequest = this.payments.paymentRequest({
          countryCode: 'US',
          currencyCode: 'USD',
          total: { amount: this.config.costUSD.toFixed(2), label: 'Total' },
        });
        this.applePay = await Promise.race([
          this.payments.applePay(this.applePayRequest),
          this.timeout(8000)
        ]);
        if (!this.applePay) {
          throw new Error('Apple Pay request timed out');
        }
      } catch (e) {
        console.error('[SquarePayment] Apple Pay init failed:', e);
        this.applePay = null;
        this.applePayRequest = null;
        throw e;
      }
    } else {
      log(`[SquarePayment] Updating Apple Pay amount`);
      try {
        this.applePayRequest.update({ total: { amount: this.config.costUSD.toFixed(2), label: 'Total' } });
      } catch (e) {
        console.error('[SquarePayment] Apple Pay amount update failed:', e);
        throw e;
      }
    }
    if (!this.attachedMethods.applePay) {
      try {
        const button = await this.waitForElementById('apple-pay-button');
        button.addEventListener('click', async event => {
          this.emitCallback('applePayClicked', event, this.applePay, this.config);
        });
        this.attachedMethods.applePay = true;
      } catch (e) {
        console.error('[SquarePayment] Apple Pay attach failed:', e);
        this.applePay = null;
        this.applePayRequest = null;
        throw e;
      }
    }
  }

  private async removeApplePay(): Promise<void> {
    if (this.applePay) {
      try {
        if (this.attachedMethods.applePay) {
          this.attachedMethods.applePay = false;
        }
        this.applePay.destroy();
      } catch (e) {
        console.error('[SquarePayment] Apple Pay destroy failed:', e);
      } finally {
        this.applePay = null;
        this.applePayRequest = null;
      }
    }
  }

  private async updateCashApp(): Promise<void> {
    this.removeCashApp();
    log('[SquarePayment] (Re)Creating Cash App...');
    try {
      const redirectHostname = document.location.hostname === 'localhost'
        ? 'http://localhost:4200'
        : `https://${document.location.hostname}`;

      this.cashAppPayRequest = this.payments.paymentRequest({
        countryCode: 'US',
        currencyCode: 'USD',
        total: {
          amount: this.config.costUSD.toFixed(2),
          label: 'Total',
          pending: true,
          productUrl: `${redirectHostname}/tx/${this.config.txid}`,
        },
      });

      this.cashAppPay = await Promise.race([
        this.payments.cashAppPay(this.cashAppPayRequest, {
          redirectURL: `${redirectHostname}/tx/${this.config.txid}`,
          referenceId: this.buildReferenceId(),
        }),
        this.timeout(8000)
      ]);
      if (!this.cashAppPay) {
        throw new Error('Cash App Pay request timed out');
      }

      this.cashAppPay.addEventListener('ontokenization', event => {
        this.emitCallback('cashAppTokenized', event, this.config);
      });
    } catch (e) {
      console.error('[SquarePayment] Cash App init failed:', e);
      this.cashAppPay = null;
      this.cashAppPayRequest = null;
      throw e;
    }
    if (!this.attachedMethods.cashApp) {
      try {
        await this.waitForElementById('cash-app-pay');
        await this.cashAppPay.attach(`#cash-app-pay`, { theme: 'dark' });
        this.attachedMethods.cashApp = true;
      } catch (e) {
        console.error('[SquarePayment] Cash App Pay attach failed:', e);
        this.cashAppPay = null;
        this.cashAppPayRequest = null;
        throw e;
      }
    }
  }

  private async removeCashApp(): Promise<void> {
    log('[SquarePayment] Removing Cash App...');
    if (this.cashAppPay) {
      try {
        if (this.attachedMethods.cashApp) {
          this.cashAppPay.detach();
          this.attachedMethods.cashApp = false;
        }
        this.cashAppPay.destroy();
      } catch (e) {
        console.error('[SquarePayment] Cash App Pay destroy failed:', e);
      } finally {
        this.cashAppPay = null;
        this.cashAppPayRequest = null;
      }
    }
  }

  private detachMethods(): void {
    if (this.attachedMethods.googlePay) {
      this.googlePay.detach();
      this.attachedMethods.googlePay = false;
    }
    this.attachedMethods.applePay = false;
    if (this.attachedMethods.cashApp) {
      this.cashAppPay.detach();
      this.attachedMethods.cashApp = false;
    }
  }

  private async cleanupMethods(): Promise<void> {
    await this.removeGooglePay();
    await this.removeApplePay();
    await this.removeCashApp();
  }

  private cleanupPaymentsAndIframes(): void {
    log('[SquarePayment] Cleaning up payments and iframes...');

    this.payments = null;

    // remove Square from window
    delete window['Square'];

    // clean up main square script
    document.querySelectorAll('head > script').forEach(script => {
      const src = script.getAttribute('src') || '';
      if (
        src.includes('square') ||
        src.includes('squareup') ||
        src.includes('squarecdn') ||
        src.includes('cash.app') ||
        src.includes('pay.google.com')
      ) {
        log('[SquarePayment] Removing script', src);
        script.remove();
      }
    });

    // clean up iframes
    document.querySelectorAll('body > iframe').forEach(iframe => {
      const src = iframe.getAttribute('src') || '';
      if (
        src.includes('square') ||
        src.includes('squareup') ||
        src.includes('squarecdn') ||
        src.includes('cash.app') ||
        src.includes('pay.google.com')
      ) {
        log('[SquarePayment] Removing iframe', src);
        iframe.remove();
      }
    });

    // clean up payment method scripts
    document.querySelectorAll('script[id^="square-payments-"]').forEach(script => {
      log('[SquarePayment] Removing payment method script', script.getAttribute('id'));
      script.remove();
    });
  }

  public async verifyBuyer(token: string, details: any, amount: string): Promise<{ token: string; userChallenged: boolean } | null> {
    try {
      const verificationDetails = {
        amount,
        currencyCode: 'USD',
        intent: 'CHARGE',
        billingContact: {
          givenName: details.card?.billing?.givenName,
          familyName: details.card?.billing?.familyName,
          phone: details.card?.billing?.phone,
          addressLines: details.card?.billing?.addressLines,
          city: details.card?.billing?.city,
          state: details.card?.billing?.state,
          countryCode: details.card?.billing?.countryCode,
        },
      };

      return await this.payments.verifyBuyer(token, verificationDetails);
    } catch (e) {
      console.error('[SquarePayment] Buyer verification failed:', e);
      return null;
    }
  }

  private buildReferenceId(): string {
    return `accelerator-${this.config?.txid?.substring(0, 15)}-${Math.round(Date.now() / 1000)}`;
  }

  private async timeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async waitFor(condition: () => boolean, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - start > timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  private waitForElementById(id: string, timeout = 10000): Promise<HTMLElement> {
    const selector = `#${CSS.escape(id)}`;
    const existing = document.querySelector<HTMLElement>(selector);
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise<HTMLElement>((resolve, reject) => {
      const observer = new MutationObserver(() => {
        const el = document.querySelector<HTMLElement>(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document, {
        childList: true,
        subtree: true,
      });
      if (timeout != null) {
        setTimeout(() => {
          observer.disconnect();
          reject(new Error(`timeout waiting for ${selector}`));
        }, timeout);
      }
    });
  }
}
