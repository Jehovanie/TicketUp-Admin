import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { map, Observable } from 'rxjs';

import { ConfirmData, ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';

/**
 * Point d'entrée unique des confirmations, comme `NotificationService` pour les
 * notifications : `confirm.ask({...}).subscribe(ok => ...)`.
 * Fermer la boîte (Échap, clic sur le fond) vaut un refus.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  ask(data: ConfirmData): Observable<boolean> {
    return this.dialog
      .open<ConfirmDialogComponent, ConfirmData, boolean>(ConfirmDialogComponent, {
        data,
        panelClass: 'app-confirm-dialog',
        backdropClass: 'app-confirm-backdrop',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
      })
      .afterClosed()
      .pipe(map((result) => result === true));
  }
}
