import { MatTooltipModule } from '@angular/material/tooltip';
import { Component, OnInit } from '@angular/core';

import { ListEventComponent } from './components/list-event/list-event.component';
import { FilterEventComponent } from './components/filter-event/filter-event.component';
import { CommonModule } from '@angular/common';

import {
  DEFAULT_EVENTS_PER_PAGE,
  EventsService,
} from '@/app/_core/services/events/events.service';

import { ICategory, IEvent, IEventFilters, IOrganizer } from '@/app/_core/model';
import { CategoryService } from '@/app/_core/services/category/category.service';
import { OrganizerService } from '@/app/_core/services/organizer/organizer.service';
import { LoadingComponent } from '@/app/_shared/components/loading/loading.component';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-event-list',
  imports: [MatTooltipModule, 
    ListEventComponent,
    FilterEventComponent,
    RouterLink,
    LoadingComponent,
    CommonModule,
  ],
  templateUrl: './event-list.component.html',
  styles: ``
})
export class EventListComponent implements OnInit {
  public data: {
    isLoading: boolean;
    events: IEvent[];
    error: string | null;
  } = {
    isLoading: true,
    events: [],
    error: null,
  };

  /** État de la pagination serveur (`page` est indexée à partir de 1). */
  public pagination = {
    page: 1,
    pageSize: DEFAULT_EVENTS_PER_PAGE,
    itemsTotal: 0,
  };

  /** Bascule grille / liste : portée par la page pour rester dans la barre d'outils. */
  /** Filtres actifs, transmis tels quels au serveur (pagination côté serveur). */
  public filters: IEventFilters = {};
  public organizers: IOrganizer[] = [];
  public categories: ICategory[] = [];

  public viewMode: 'grid' | 'list' = 'grid';

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode = mode;
  }

  constructor(
    private eventService: EventsService,
    private organizerService: OrganizerService,
    private categoryService: CategoryService
  ) {}

  ngOnInit(): void {
    this.loadEvents();
    this.loadFilterOptions();
  }

  /** Options des listes déroulantes : leur échec ne doit pas bloquer la liste. */
  private loadFilterOptions(): void {
    this.organizerService.getMyOrganizers().subscribe({
      next: (organizers) => (this.organizers = organizers),
      error: (e) => console.error('Erreur lors du chargement des organisations:', e),
    });
    this.categoryService.getAllCategries().subscribe({
      next: (categories) => (this.categories = categories),
      error: (e) => console.error('Erreur lors du chargement des catégories:', e),
    });
  }

  /** Un filtre change : on repart de la première page, le nombre de résultats n'est plus le même. */
  onFiltersChange(filters: IEventFilters): void {
    this.filters = filters;
    this.loadEvents(1);
  }

  loadEvents(
    page: number = this.pagination.page,
    pageSize: number = this.pagination.pageSize
  ): void {
    this.data = { ...this.data, isLoading: true, error: null };

    this.eventService.getMyEvents(page, pageSize, this.filters).subscribe({
      next: (result) => {
        this.pagination = {
          page: result.currentPage ?? page,
          pageSize: result.nombreParPage ?? pageSize,
          itemsTotal: result.itemsTotal ?? 0,
        };

        this.data = {
          isLoading: false,
          events: Array.isArray(result.items) ? result.items : [],
          error: null,
        };
      },
      error: (e) => {
        console.error('Erreur lors du chargement des événements:', e);
        this.data = {
          isLoading: false,
          events: [],
          // Les 400/403 des filtres portent un message métier exploitable.
          error: e?.error?.message ?? 'Impossible de charger les événements.',
        };
      },
    });
  }

  /** Le composant enfant demande une autre page : on refait un appel serveur. */
  onPageChange(page: number): void {
    this.loadEvents(page);
  }

  /** Changer la taille de page renvoie toujours sur la première page. */
  onPageSizeChange(pageSize: number): void {
    this.loadEvents(1, pageSize);
  }
}
