import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { IEvent } from '@/app/_core/model';
import { OrganizerService } from '@/app/_core/services/organizer/organizer.service';
import { ListEventComponent } from '@/app/features/events/event-list/components/list-event/list-event.component';
import { LoadingComponent } from '@/app/_shared/components/loading/loading.component';

type Period = 'upcoming' | 'ongoing' | 'past';

/** Plafond serveur de `itemsPerPage` sur `/organizers/{id}/events`. */
const MAX_PAGE_SIZE = 20;

@Component({
  selector: 'app-organizer-events',
  imports: [CommonModule, RouterLink, MatIconModule, ListEventComponent, LoadingComponent],
  templateUrl: './organizer-events.component.html',
})
export class OrganizerEventsComponent implements OnChanges {
  @Input({ required: true }) organizerId!: number;
  @Input() canCreate = false;

  readonly periods: { key: Period | undefined; label: string }[] = [
    { key: undefined, label: 'Tous' },
    { key: 'upcoming', label: 'À venir' },
    { key: 'ongoing', label: 'En cours' },
    { key: 'past', label: 'Passés' },
  ];

  period: Period | undefined;
  events: IEvent[] = [];
  itemsTotal = 0;
  page = 1;
  pageSize = 12;
  isLoading = true;
  error: string | null = null;

  constructor(private organizerService: OrganizerService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['organizerId']) this.load();
  }

  load(): void {
    this.isLoading = true;
    this.error = null;
    this.organizerService
      .getOrganizerEvents(this.organizerId, this.page, this.pageSize, { period: this.period })
      .subscribe({
        next: (result) => {
          this.events = result.items;
          this.itemsTotal = result.itemsTotal;
          this.isLoading = false;
        },
        error: (e) => {
          console.error('Erreur lors du chargement des événements:', e);
          this.error = e?.error?.message ?? 'Impossible de charger les événements.';
          this.isLoading = false;
        },
      });
  }

  setPeriod(period: Period | undefined): void {
    this.period = period;
    this.page = 1;
    this.load();
  }

  onPageChange(page: number): void {
    this.page = page;
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = Math.min(size, MAX_PAGE_SIZE);
    this.page = 1;
    this.load();
  }
}
