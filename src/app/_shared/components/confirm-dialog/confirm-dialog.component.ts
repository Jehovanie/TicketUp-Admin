import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export type ConfirmTone = 'primary' | 'danger';

export interface ConfirmData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` pour une action destructive : le bouton passe au rouge et le focus à « Annuler ». */
  tone?: ConfirmTone;
  /** Nom d'icône Material ; par défaut selon le ton. */
  icon?: string;
}

/**
 * Boîte de confirmation de l'application, à la place du `confirm()` natif du
 * navigateur (gris, non stylable, titrée du nom de domaine).
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div
      class="w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gray-200"
      role="alertdialog"
      aria-labelledby="confirmTitle"
      aria-describedby="confirmMessage"
    >
      <div class="flex items-start gap-4">
        <span
          class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
          [ngClass]="isDanger ? 'bg-danger-50 text-danger-600' : 'bg-primary-50 text-primary-700'"
        >
          <mat-icon class="!h-6 !w-6 !text-2xl">{{ icon }}</mat-icon>
        </span>

        <div class="min-w-0 flex-1 pt-0.5">
          <h2 id="confirmTitle" class="text-base font-semibold text-gray-900">{{ data.title }}</h2>
          <p id="confirmMessage" class="mt-1.5 text-sm leading-5 text-gray-500">{{ data.message }}</p>
        </div>
      </div>

      <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          (click)="close(false)"
          [attr.cdkFocusInitial]="isDanger ? '' : null"
          class="inline-flex h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {{ data.cancelLabel ?? 'Annuler' }}
        </button>
        <button
          type="button"
          (click)="close(true)"
          [attr.cdkFocusInitial]="isDanger ? null : ''"
          class="inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-medium text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          [ngClass]="
            isDanger
              ? 'bg-danger-600 hover:bg-danger-700 focus-visible:ring-danger-500'
              : 'bg-primary hover:bg-primary-800 focus-visible:ring-primary-500'
          "
        >
          {{ data.confirmLabel ?? 'Confirmer' }}
        </button>
      </div>
    </div>
  `,
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ConfirmDialogComponent, boolean>);

  get isDanger(): boolean {
    return this.data.tone === 'danger';
  }

  get icon(): string {
    return this.data.icon ?? (this.isDanger ? 'warning_amber' : 'help_outline');
  }

  close(result: boolean): void {
    this.ref.close(result);
  }
}
