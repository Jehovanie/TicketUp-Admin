import { ICategory } from './category.interface';
import { ILocation } from './location.interface';
import { IOrganizer } from './organizer.interface';
import { ITicket } from './ticket.interface';
import { ITicketType } from './ticket-type.interface';

export interface IEvent {
  id?: string;
  title?: string;
  description?: string;
  startedAt: Date;
  endAt: Date;
  imageUrl?: string[];
  status?: string | boolean;
  createdAt?: Date;
  updatedAt?: Date;
  location: ILocation;
  organizer: IOrganizer | string;
  category: ICategory | string;
  tickets?: ITicket[];
  ticket_type?: ITicketType[];
}

/** Publication d'un événement : `status` booléen côté API (`true` = publié). */
export type EventPublication = 'published' | 'draft';

/** Position dans le temps, calculée par le serveur par rapport à l'heure courante. */
export type EventPeriod = 'upcoming' | 'ongoing' | 'past';

export type EventSort = 'startedAt:asc' | 'startedAt:desc' | 'createdAt:desc' | 'title:asc';

/**
 * Filtres de la liste des événements. Tous facultatifs et combinables ;
 * l'absence d'un filtre (ou une chaîne vide) signifie « tous ».
 */
export interface IEventFilters {
  /** Recherche dans le titre. */
  title?: string;
  organizer?: string | number;
  category?: string | number;
  status?: EventPublication;
  period?: EventPeriod;
  /** `AAAA-MM-JJ` : événements commençant à partir de cette date (incluse). */
  startDate?: string;
  /** `AAAA-MM-JJ` : événements commençant jusqu'à cette date (incluse). */
  endDate?: string;
  sort?: EventSort;
}

/**
 * Corps de `PATCH /events/{id}` : n'importe quel sous-ensemble de ces champs.
 * Billets et organisation ne se modifient pas ici ; `status` n'accepte que
 * `true` (publier) — voir le bouton « Publier » du détail.
 */
export interface IUpdateEventPayload {
  title?: string;
  description?: string;
  /** Date ISO 8601. */
  startedAt?: string;
  endAt?: string;
  /** Identifiant, ou `null` pour retirer la catégorie. */
  category?: number | null;
  location?: number;
}
