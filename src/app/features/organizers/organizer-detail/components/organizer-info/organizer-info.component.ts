import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import { IOrganizerDetail, MobileMoneyProvider } from '@/app/_core/model';
import { OrganizerService } from '@/app/_core/services/organizer/organizer.service';
import { BtnLoadingComponent } from '@/app/_shared/components/btn-loading/btn-loading.component';
import { PaymentMethodsFieldsComponent } from '@/app/_shared/components/payment-methods-fields/payment-methods-fields.component';
import { NotificationService } from '@/app/_shared/services/notification.service';
import {
  emptyPaymentEntries,
  IPaymentEntry,
  isValidAccountName,
  isValidMobileMoneyPhone,
  PaymentEntries,
  PROVIDER_OPTIONS,
} from '@/app/_shared/utils/payment-methods';

/**
 * Informations de l'organisation : lecture seule pour un membre, formulaire
 * d'édition pour un administrateur ou plus (`ORGANIZER_EDIT`).
 */
@Component({
  selector: 'app-organizer-info',
  imports: [CommonModule, FormsModule, MatIconModule, BtnLoadingComponent, PaymentMethodsFieldsComponent],
  templateUrl: './organizer-info.component.html',
})
export class OrganizerInfoComponent implements OnChanges {
  @Input({ required: true }) organizer!: IOrganizerDetail;
  @Input() canEdit = false;
  /** Remonte la fiche mise à jour pour que la page (en-tête compris) reste cohérente. */
  @Output() updated = new EventEmitter<IOrganizerDetail>();

  readonly providers = PROVIDER_OPTIONS;
  readonly isEditing = signal(false);
  readonly submitted = signal(false);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly name = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly website = signal('');
  readonly payments = signal<PaymentEntries>(emptyPaymentEntries());

  readonly isValidName = computed(() => {
    const v = this.name().trim();
    return v.length > 0 && v.length <= 100;
  });
  readonly isValidEmail = computed(() => {
    const v = this.email().trim();
    return v.length > 0 && v.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  });
  readonly isValidWebsite = computed(() => {
    const v = this.website().trim();
    return v.length === 0 || /^https?:\/\/\S+$/.test(v);
  });
  readonly enabledProviders = computed(() =>
    this.providers.filter((o) => this.payments()[o.provider].enabled)
  );
  readonly isPaymentsValid = computed(
    () =>
      this.enabledProviders().length > 0 &&
      this.enabledProviders().every((o) => {
        const entry = this.payments()[o.provider];
        return isValidMobileMoneyPhone(o.provider, entry.phoneNumber) && isValidAccountName(entry.accountName);
      })
  );
  readonly isFormValid = computed(
    () => this.isValidName() && this.isValidEmail() && this.isValidWebsite() && this.isPaymentsValid()
  );

  constructor(private organizerService: OrganizerService, private notification: NotificationService) {}

  ngOnChanges(): void {
    if (!this.isEditing()) this.resetForm();
  }

  startEdit(): void {
    this.resetForm();
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
    this.resetForm();
  }

  toggleProvider(provider: MobileMoneyProvider): void {
    this.updatePayment(provider, { enabled: !this.payments()[provider].enabled });
  }

  updatePayment(provider: MobileMoneyProvider, patch: Partial<IPaymentEntry>): void {
    this.payments.update((all) => ({ ...all, [provider]: { ...all[provider], ...patch } }));
  }

  save(): void {
    this.submitted.set(true);
    this.submitError.set(null);

    if (!this.isFormValid()) {
      this.notification.error('Certains champs sont invalides ou incomplets.', 'Formulaire incomplet');
      return;
    }

    this.isSubmitting.set(true);
    this.organizerService
      .updateOrganizer(this.organizer.id!, {
        name: this.name().trim(),
        email: this.email().trim(),
        phone: this.phone().trim() || null,
        website: this.website().trim() || null,
        // Remplace la liste entière : un opérateur décoché est supprimé côté API.
        paymentMethods: this.enabledProviders().map((o) => ({
          provider: o.provider,
          phoneNumber: this.payments()[o.provider].phoneNumber.trim(),
          accountName: this.payments()[o.provider].accountName.trim(),
        })),
      })
      .subscribe({
        next: (organizer) => {
          this.isSubmitting.set(false);
          this.isEditing.set(false);
          this.submitted.set(false);
          this.notification.success(`${organizer.name} a été mise à jour.`, 'Organisateur modifié');
          this.updated.emit(organizer);
        },
        error: (e) => {
          this.isSubmitting.set(false);
          const message = e?.error?.message ?? "Impossible de modifier l'organisateur.";
          this.submitError.set(message);
          this.notification.error(message, 'Échec de la modification');
        },
      });
  }

  providerOption(provider: string) {
    return this.providers.find((o) => o.provider === provider);
  }

  private resetForm(): void {
    this.name.set(this.organizer?.name ?? '');
    this.email.set(this.organizer?.email ?? '');
    this.phone.set(this.organizer?.phone ?? '');
    this.website.set(this.organizer?.website ?? '');
    this.submitted.set(false);
    this.submitError.set(null);

    const entries = emptyPaymentEntries();
    for (const method of this.organizer?.paymentMethods ?? []) {
      entries[method.provider] = {
        enabled: true,
        phoneNumber: method.phoneNumber,
        accountName: method.accountName,
      };
    }
    this.payments.set(entries);
  }
}
