import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject, debounceTime, takeUntil } from 'rxjs';

import {
  EventPeriod,
  EventPublication,
  EventSort,
  ICategory,
  IEventFilters,
  IOrganizer,
} from '@/app/_core/model';

/**
 * Barre de filtres de la liste des événements.
 *
 * Présentationnelle : elle ne charge rien. Les listes d'organisations et de
 * catégories viennent de la page, et chaque changement remonte l'ensemble des
 * filtres actifs via `filtersChange` (la page refait alors l'appel serveur).
 */
@Component({
  selector: 'app-filter-event',
  imports: [CommonModule],
  templateUrl: './filter-event.component.html',
  styleUrl: './filter-event.component.css',
})
export class FilterEventComponent implements OnInit, OnDestroy {
  @Input() organizers: IOrganizer[] = [];
  @Input() categories: ICategory[] = [];
  /** Filtres initiaux (ex. restaurés depuis l'URL). */
  @Input() filters: IEventFilters = {};
  @Output() filtersChange = new EventEmitter<IEventFilters>();

  readonly publications: { key: EventPublication | ''; label: string }[] = [
    { key: '', label: 'Tous' },
    { key: 'published', label: 'Publiés' },
    { key: 'draft', label: 'Brouillons' },
  ];

  readonly periods: { key: EventPeriod | ''; label: string }[] = [
    { key: '', label: 'Toutes' },
    { key: 'upcoming', label: 'À venir' },
    { key: 'ongoing', label: 'En cours' },
    { key: 'past', label: 'Passés' },
  ];

  readonly sorts: { key: EventSort | ''; label: string }[] = [
    { key: '', label: 'Plus récemment créés' },
    { key: 'startedAt:asc', label: 'Début le plus proche' },
    { key: 'startedAt:desc', label: 'Début le plus lointain' },
    { key: 'title:asc', label: 'Titre (A → Z)' },
  ];

  current: IEventFilters = {};

  private title$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Lu une seule fois : relire l'entrée à chaque émission écraserait une saisie en cours.
    this.current = { ...this.filters };

    // Le titre est tapé touche par touche : on n'interroge le serveur qu'à la pause.
    this.title$.pipe(debounceTime(350), takeUntil(this.destroy$)).subscribe((title) => {
      this.patch({ title });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Nombre de filtres actifs : le tri n'en est pas un. */
  get activeCount(): number {
    const { sort, ...rest } = this.current;
    return Object.values(rest).filter((v) => String(v ?? '').trim() !== '').length;
  }

  onTitle(value: string): void {
    this.current = { ...this.current, title: value };
    this.title$.next(value.trim());
  }

  patch(change: Partial<IEventFilters>): void {
    this.current = { ...this.current, ...change };
    this.filtersChange.emit(this.clean(this.current));
  }

  reset(): void {
    this.current = {};
    this.filtersChange.emit({});
  }

  /** Retire les valeurs vides : « tous » = filtre absent. */
  private clean(filters: IEventFilters): IEventFilters {
    return Object.fromEntries(
      Object.entries(filters).filter(([, v]) => String(v ?? '').trim() !== '')
    ) as IEventFilters;
  }
}
