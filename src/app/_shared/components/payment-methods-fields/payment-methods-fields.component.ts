import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { MobileMoneyProvider } from '@/app/_core/model';
import {
  IPaymentEntry,
  isValidAccountName,
  isValidMobileMoneyPhone,
  PaymentEntries,
  PROVIDER_OPTIONS,
} from '@/app/_shared/utils/payment-methods';

/**
 * Champs de saisie des comptes mobile money, partagés entre la création et la
 * modification d'une organisation. Présentationnel : l'état reste chez le parent.
 */
@Component({
  selector: 'app-payment-methods-fields',
  imports: [CommonModule, MatIconModule],
  templateUrl: './payment-methods-fields.component.html',
})
export class PaymentMethodsFieldsComponent {
  @Input({ required: true }) payments!: PaymentEntries;
  /** Les erreurs n'apparaissent qu'après une première tentative d'envoi. */
  @Input() submitted = false;

  @Output() toggled = new EventEmitter<MobileMoneyProvider>();
  @Output() changed = new EventEmitter<{ provider: MobileMoneyProvider; patch: Partial<IPaymentEntry> }>();

  readonly providers = PROVIDER_OPTIONS;

  isPhoneValid(provider: MobileMoneyProvider): boolean {
    return isValidMobileMoneyPhone(provider, this.payments[provider].phoneNumber);
  }

  isNameValid(provider: MobileMoneyProvider): boolean {
    return isValidAccountName(this.payments[provider].accountName);
  }
}
