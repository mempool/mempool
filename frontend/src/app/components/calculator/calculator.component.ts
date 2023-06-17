import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { combineLatest, Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Price, PriceService } from '../../services/price.service';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalculatorComponent implements OnInit {
  satoshis = 10000;
  form: FormGroup;

  currency: string;
  currency$ = this.stateService.fiatCurrency$;
  mainSubscription$: Observable<any>;
  price$: Observable<number>;

  constructor(
    private priceService: PriceService,
    private stateService: StateService,
    private formBuilder: FormBuilder,
    private websocketService: WebsocketService,
  ) { }

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      fiat: [0],
      bitcoin: [0],
      satoshis: [0],
    });

    this.price$ = this.currency$.pipe(
      switchMap((currency) => {
        this.currency = currency; 
        return this.stateService.conversions$.asObservable();
      }),
      map((conversions) => {
        return conversions[this.currency];
      })
    );

    combineLatest([
      this.price$,
      this.form.get('fiat').valueChanges
    ]).subscribe(([price, value]) => {
      value = parseFloat(value.replace(',', '.'));
      value = value || 0;
      const rate = (value / price).toFixed(8);
      const satsRate = Math.round(value / price * 100_000_000);
      this.form.get('bitcoin').setValue(rate, { emitEvent: false });
      this.form.get('satoshis').setValue(satsRate, { emitEvent: false } );
    });

    combineLatest([
      this.price$,
      this.form.get('bitcoin').valueChanges
    ]).subscribe(([price, value]) => {
      value = parseFloat(value.replace(',', '.'));
      value = value || 0;
      const rate = parseFloat((value * price).toFixed(8));
      this.form.get('fiat').setValue(rate, { emitEvent: false } );
      this.form.get('satoshis').setValue(Math.round(value * 100_000_000), { emitEvent: false } );
    });

    combineLatest([
      this.price$,
      this.form.get('satoshis').valueChanges
    ]).subscribe(([price, value]) => {
      value = parseFloat(value.replace(',', '.'));
      value = value || 0;
      const rate = parseFloat((value / 100_000_000 * price).toFixed(8));
      const bitcoinRate = (value / 100_000_000).toFixed(8);
      this.form.get('fiat').setValue(rate, { emitEvent: false } );
      this.form.get('bitcoin').setValue(bitcoinRate, { emitEvent: false });
    });

  }

}
