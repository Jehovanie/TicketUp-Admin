import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { IPaymentMethod, MobileMoneyProvider } from '@/app/_core/model';
import {
  emptyPaymentEntries,
  IPaymentEntry,
  isValidAccountName,
  isValidMobileMoneyPhone,
  PaymentEntries,
  PROVIDER_OPTIONS,
} from '@/app/_shared/utils/payment-methods';
import { PaymentMethodsFieldsComponent } from '@/app/_shared/components/payment-methods-fields/payment-methods-fields.component';
import { OrganizerService } from '@/app/_core/services/organizer/organizer.service';
import { BtnLoadingComponent } from '@/app/_shared/components/btn-loading/btn-loading.component';
import { NotificationService } from '@/app/_shared/services/notification.service';

@Component({
  selector: 'app-organizer-new',
  // `FormsModule` porte `(ngSubmit)` : sans lui, l'écouteur ne se rattache à
  // aucun événement réel et le bouton d'envoi ne déclenche rien.
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, BtnLoadingComponent, PaymentMethodsFieldsComponent],
  templateUrl: './organizer-new.component.html',
  host: {
    class: 'block h-full'
  },
  styles: ``,
})
export class OrganizerNewComponent {
  readonly name = signal('');
  readonly email = signal('');
  readonly phone = signal('');
  readonly website = signal('');

  readonly providers = PROVIDER_OPTIONS;

  readonly payments = signal<PaymentEntries>(emptyPaymentEntries());

  /** Passe à `true` à la première tentative d'envoi : on n'accuse pas l'utilisateur avant. */
  readonly submitted = signal(false);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);

  /**
   * Les règles reprennent celles du contrôleur API (`CreateOrganizerController`)
   * pour éviter un aller-retour réseau qui n'apprendrait rien — le serveur
   * revalide de toute façon, il reste seul juge.
   */
  readonly isValidName = computed(() => {
    const value = this.name().trim();
    return value.length > 0 && value.length <= 100;
  });

  readonly isValidEmail = computed(() => {
    const value = this.email().trim();
    return value.length > 0 && value.length <= 100 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  });

  readonly isValidWebsite = computed(() => {
    const value = this.website().trim();
    return value.length === 0 || /^https?:\/\/\S+$/.test(value);
  });

  readonly enabledProviders = computed(() =>
    this.providers.filter((o) => this.payments()[o.provider].enabled)
  );

  /** Au moins un compte est exigé : sans lui, aucun billet ne pourrait être encaissé. */
  readonly hasPaymentMethod = computed(() => this.enabledProviders().length > 0);

  readonly isPaymentsValid = computed(
    () =>
      this.hasPaymentMethod() &&
      this.enabledProviders().every(
        (o) => this.isValidPhone(o.provider) && this.isValidAccountName(o.provider)
      )
  );

  readonly isFormValid = computed(
    () =>
      this.isValidName() &&
      this.isValidEmail() &&
      this.isValidWebsite() &&
      this.isPaymentsValid()
  );

  constructor(
    private organizerService: OrganizerService,
    private router: Router,
    private notification: NotificationService
  ) {}

  toggleProvider(provider: MobileMoneyProvider): void {
    this.updatePayment(provider, { enabled: !this.payments()[provider].enabled });
  }

  updatePayment(provider: MobileMoneyProvider, patch: Partial<IPaymentEntry>): void {
    this.payments.update((all) => ({ ...all, [provider]: { ...all[provider], ...patch } }));
  }

  isValidPhone(provider: MobileMoneyProvider): boolean {
    return isValidMobileMoneyPhone(provider, this.payments()[provider].phoneNumber);
  }

  isValidAccountName(provider: MobileMoneyProvider): boolean {
    return isValidAccountName(this.payments()[provider].accountName);
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.submitError.set(null);

    if (!this.isFormValid()) {
      this.notification.error(
        'Certains champs obligatoires sont incomplets.',
        'Formulaire incomplet'
      );
      return;
    }

    this.isSubmitting.set(true);

    this.organizerService
      .createOrganizer({
        name: this.name().trim(),
        email: this.email().trim(),
        // Les champs vides partent à `null` : l'API les stocke tels quels.
        phone: this.phone().trim() || null,
        website: this.website().trim() || null,
        paymentMethods: this.enabledProviders().map(
          (o): IPaymentMethod => ({
            provider: o.provider,
            phoneNumber: this.payments()[o.provider].phoneNumber.trim(),
            accountName: this.payments()[o.provider].accountName.trim(),
          })
        ),
      })
      .subscribe({
        next: (organizer) => {
          this.isSubmitting.set(false);
          this.notification.success(
            `${organizer.name} a été créée. Vous en êtes le responsable.`,
            'Organisateur créé'
          );
          this.router.navigate(['/organizers']);
        },
        error: (e) => {
          this.isSubmitting.set(false);
          // L'API renvoie un message métier exploitable ; on le préfère au nôtre.
          const message =
            e?.error?.message ?? "Impossible de créer l'organisateur.";
          this.submitError.set(message);
          this.notification.error(message, 'Échec de la création');
        },
      });
  }
}
