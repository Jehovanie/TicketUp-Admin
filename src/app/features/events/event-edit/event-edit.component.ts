import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { ICategory, IEvent, ILocation, IUpdateEventPayload } from '@/app/_core/model';
import { CategoryService } from '@/app/_core/services/category/category.service';
import { EventsService } from '@/app/_core/services/events/events.service';
import { LocationService } from '@/app/_core/services/location/location.service';
import { BtnLoadingComponent } from '@/app/_shared/components/btn-loading/btn-loading.component';
import { LoadingComponent } from '@/app/_shared/components/loading/loading.component';
import {
  SearchSelectComponent,
  SearchSelectOption,
} from '@/app/_shared/components/search-select/search-select.component';
import { AriaryPipe } from '@/app/_shared/pipes/ariary.pipe';
import { NotificationService } from '@/app/_shared/services/notification.service';

/** `2027-01-15T18:00:00+03:00` → `2027-01-15T18:00`, en heure locale (valeur d'un `datetime-local`). */
function toLocalInput(iso: string | Date | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Modification d'un événement (`PATCH /events/{id}`).
 *
 * L'API ne laisse modifier que titre, description, dates, lieu et catégorie :
 * l'organisation et les billets sont affichés en lecture seule, et seuls les
 * champs réellement changés sont envoyés (un événement publié ne peut pas être
 * « terminé » par une modification : ne pas toucher aux dates évite ce refus).
 */
@Component({
  selector: 'app-event-edit',
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    BtnLoadingComponent,
    LoadingComponent,
    SearchSelectComponent,
    AriaryPipe,
  ],
  templateUrl: './event-edit.component.html',
  host: { class: 'block h-full' },
})
export class EventEditComponent implements OnInit {
  eventId!: string;
  original: IEvent | null = null;

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly title = signal('');
  readonly description = signal('');
  readonly startedAt = signal('');
  readonly endAt = signal('');
  readonly locationId = signal<number | null>(null);
  readonly categoryId = signal<number | null>(null);

  readonly submitted = signal(false);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly categories = signal<ICategory[]>([]);
  readonly locations = signal<ILocation[]>([]);

  readonly locationOptions = computed<SearchSelectOption[]>(() =>
    this.locations().map((l) => ({ value: l.id, label: l.name, hint: `${l.size} places` }))
  );
  readonly categoryOptions = computed<SearchSelectOption[]>(() =>
    this.categories().map((c) => ({
      value: c.id ?? '',
      label: c.name ?? 'Sans nom',
      color: c.color || '#9ca3af',
    }))
  );

  readonly isValidTitle = computed(() => {
    const v = this.title().trim();
    return v.length >= 3 && v.length <= 150;
  });
  readonly isValidDescription = computed(() => this.description().trim().length >= 3);
  readonly isValidStart = computed(() => this.startedAt().length > 0);
  readonly isValidEnd = computed(() => {
    const end = this.endAt();
    if (end.length === 0) return false;
    const start = this.startedAt();
    return start.length === 0 || new Date(end) > new Date(start);
  });
  readonly isValidLocation = computed(() => this.locationId() !== null);

  readonly isFormValid = computed(
    () =>
      this.isValidTitle() &&
      this.isValidDescription() &&
      this.isValidStart() &&
      this.isValidEnd() &&
      this.isValidLocation()
  );

  /** Seuls les champs modifiés partent dans le PATCH. */
  readonly changes = computed<IUpdateEventPayload>(() => {
    const o = this.original;
    if (!o) return {};
    const payload: IUpdateEventPayload = {};

    if (this.title().trim() !== (o.title ?? '')) payload.title = this.title().trim();
    if (this.description().trim() !== (o.description ?? '').trim()) {
      payload.description = this.description().trim();
    }
    if (this.startedAt() && this.startedAt() !== toLocalInput(o.startedAt)) {
      payload.startedAt = new Date(this.startedAt()).toISOString();
    }
    if (this.endAt() && this.endAt() !== toLocalInput(o.endAt)) {
      payload.endAt = new Date(this.endAt()).toISOString();
    }
    if (this.locationId() !== null && this.locationId() !== this.idOf(o.location)) {
      payload.location = this.locationId()!;
    }
    if (this.categoryId() !== this.idOf(o.category)) {
      payload.category = this.categoryId();
    }
    return payload;
  });

  readonly hasChanges = computed(() => Object.keys(this.changes()).length > 0);

  readonly durationLabel = computed<string | null>(() => {
    const start = this.startedAt();
    const end = this.endAt();
    if (!start || !end) return null;
    const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (minutes <= 0) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return minutes % 60 > 0 ? `${hours} h ${minutes % 60}` : `${hours} h`;
    const days = Math.round(hours / 24);
    return days < 31 ? `${days} jour${days > 1 ? 's' : ''}` : `${Math.round(days / 30)} mois`;
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventsService: EventsService,
    private categoryService: CategoryService,
    private locationService: LocationService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.eventId = this.route.snapshot.paramMap.get('eventID') ?? '';
    this.loadEvent();

    this.categoryService.getAllCategries().subscribe({
      next: (c) => this.categories.set(c),
      error: () => this.categories.set([]),
    });
    this.locationService.getAllLocations().subscribe({
      next: (l) => this.locations.set(l),
      error: () => this.locations.set([]),
    });
  }

  loadEvent(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.eventsService.getEvent(this.eventId).subscribe({
      next: (event) => {
        this.original = event;
        this.title.set(event.title ?? '');
        this.description.set(event.description ?? '');
        this.startedAt.set(toLocalInput(event.startedAt));
        this.endAt.set(toLocalInput(event.endAt));
        this.locationId.set(this.idOf(event.location));
        this.categoryId.set(this.idOf(event.category));
        this.isLoading.set(false);
      },
      error: (e) => {
        console.error("Erreur lors du chargement de l'événement:", e);
        this.loadError.set(
          e?.status === 404 ? 'Événement introuvable.' : "Impossible de charger l'événement."
        );
        this.isLoading.set(false);
      },
    });
  }

  onSelectLocation(value: string): void {
    this.locationId.set(value ? +value : null);
  }

  onSelectCategory(value: string): void {
    this.categoryId.set(value ? +value : null);
  }

  get venueCapacity(): number | null {
    return this.locations().find((l) => +l.id === this.locationId())?.size ?? null;
  }

  /** Un événement terminé n'est plus modifiable : la page affiche un blocage au lieu du formulaire. */
  get isPast(): boolean {
    return !!this.original && new Date(this.original.endAt) < new Date();
  }

  get isPublished(): boolean {
    return this.original?.status === true;
  }

  get isDraft(): boolean {
    return this.original?.status === false;
  }

  get organizerName(): string | null {
    const o = this.original?.organizer;
    return o && typeof o === 'object' ? (o.name ?? null) : null;
  }

  get ticketTypes() {
    return this.original?.ticket_type ?? [];
  }

  onSubmit(): void {
    if (this.isPast) return;

    this.submitted.set(true);
    this.submitError.set(null);

    if (!this.isFormValid()) {
      this.notification.error('Certains champs obligatoires sont incomplets.', 'Formulaire incomplet');
      return;
    }
    if (!this.hasChanges()) {
      this.notification.info("Vous n'avez modifié aucun champ.", 'Aucune modification');
      return;
    }

    this.isSubmitting.set(true);
    this.eventsService.updateEvent(this.eventId, this.changes()).subscribe({
      next: (updated) => {
        this.isSubmitting.set(false);
        this.notification.success(`« ${updated?.title || this.title()} » a été mis à jour.`, 'Événement modifié');
        this.router.navigate(['/events', this.eventId]);
      },
      error: (e) => {
        console.error("Erreur lors de la modification de l'événement:", e);
        this.isSubmitting.set(false);
        // Les règles métier de l'API (dates, événement publié terminé…) sont explicites.
        const message =
          e?.status === 403
            ? "Vous n'avez pas le droit de modifier cet événement."
            : (e?.error?.message ?? "La modification a échoué. Vérifiez les informations puis réessayez.");
        this.submitError.set(message);
        this.notification.error(message, 'Échec de la modification');
      },
    });
  }

  private idOf(value: unknown): number | null {
    if (value && typeof value === 'object' && 'id' in value) {
      const id = Number((value as { id: unknown }).id);
      return Number.isFinite(id) ? id : null;
    }
    return null;
  }
}
