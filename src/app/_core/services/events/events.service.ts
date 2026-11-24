import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environements/environement';
import { AppService } from '../AppService';
import { IApiResponse, IEvent, IEventFilters, IUpdateEventPayload, IEventStatusDetail, IPaginated } from '../../model';
import { map, Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/** Nombre d'événements demandés par défaut au serveur. */
export const DEFAULT_EVENTS_PER_PAGE = 12;

@Injectable({
  providedIn: 'root',
})
export class EventsService extends AppService {
  constructor(httpClient: HttpClient, private auth: AuthService) {
    super(httpClient, environment.apiUrl);
  }

  /**
   * Liste paginée côté serveur.
   * @param page numéro de page indexé à partir de 1 (convention de l'API).
   */
  getAllEvents(
    page = 1,
    itemsPerPage = DEFAULT_EVENTS_PER_PAGE,
    filters: IEventFilters = {}
  ): Observable<IPaginated<IEvent>> {
    const params = this.listParams(page, itemsPerPage, filters);

    return this.get<IApiResponse<IPaginated<IEvent>>>('/events', params).pipe(
      map((response) => response.data)
    );
  }

  /**
   * Uniquement les événements qui concernent l'utilisateur connecté.
   *
   * Un événement n'a pas d'auteur : il appartient à une organisation, et c'est
   * l'appartenance (`OrganizerMembership`) qui fait le lien. `/events/me` renvoie
   * donc l'union des événements des organisations dont la personne est membre,
   * dans exactement la même enveloppe que `/events`.
   *
   * Le fondateur, lui, n'appartient à aucune organisation : sa liste arriverait
   * vide alors qu'il a accès à tout. On lui sert l'inventaire complet.
   */
  getMyEvents(
    page = 1,
    itemsPerPage = DEFAULT_EVENTS_PER_PAGE,
    filters: IEventFilters = {}
  ): Observable<IPaginated<IEvent>> {
    if (this.auth.isSuperAdmin()) {
      return this.getAllEvents(page, itemsPerPage, filters);
    }

    const params = this.listParams(page, itemsPerPage, filters);

    return this.get<IApiResponse<IPaginated<IEvent>>>('/events/me', params).pipe(
      map((response) => response.data)
    );
  }

  /**
   * Pagination + filtres en query string. Un filtre vide n'est pas envoyé :
   * « tous » se dit par l'absence du paramètre, pas par une valeur.
   */
  private listParams(page: number, itemsPerPage: number, filters: IEventFilters): HttpParams {
    let params = new HttpParams().set('page', page).set('itemsPerPage', itemsPerPage);
    for (const [key, value] of Object.entries(filters)) {
      const text = String(value ?? '').trim();
      if (text !== '') params = params.set(key, text);
    }
    return params;
  }

  getEvent(eventID: string | number): Observable<IEvent> {
    return this.get<IApiResponse<IEvent>>(`/events/${eventID}`).pipe(
      map((response) => response.data)
    );
  }

  /**
   * L'écriture ne renvoie pas forcément l'enveloppe `{ message, status, data }` :
   * selon l'endpoint, l'entité peut arriver à la racine, voire le corps être
   * vide. On déballe donc sans supposer la forme — sinon le résultat est
   * `undefined` et le composant appelant plante sur `createdEvent.title`.
   */
  createEvent(event: IEvent): Observable<IEvent | null> {
    return this.post<IApiResponse<IEvent> | IEvent | null>('/events', event).pipe(
      map((response) => this.unwrap(response))
    );
  }

  updateEvent(eventID: string | number, changes: IUpdateEventPayload): Observable<IEvent | null> {
    return this.patch<IApiResponse<IEvent> | IEvent | null>(`/events/${eventID}`, changes).pipe(
      map((response) => this.unwrap(response))
    );
  }

  /**
   * Passe un brouillon en « publié » (`POST /events/{id}/publish`).
   * Réservé au responsable et aux administrateurs de l'organisation : l'API
   * reste seule juge et répond 403 sinon.
   */
  publishEvent(eventID: string | number): Observable<IEvent | null> {
    return this.post<IApiResponse<IEvent> | IEvent | null>(`/events/${eventID}/publish`, {}).pipe(
      map((response) => this.unwrap(response))
    );
  }

  private unwrap(response: IApiResponse<IEvent> | IEvent | null): IEvent | null {
    if (!response) {
      return null;
    }
    if (typeof response === 'object' && 'data' in response) {
      return (response as IApiResponse<IEvent>).data ?? null;
    }
    return response as IEvent;
  }

  deleteEvent(eventID: string | number): Observable<void> {
    return this.remove<unknown>(`/events/${eventID}`).pipe(map(() => undefined));
  }

  /**
   * Statistiques de vente. Cet endpoint a sa propre forme :
   * `{ events: { event, statusTicket } }`, sans enveloppe `data`.
   */
  getDetailStatusEvent(
    eventID: string | number
  ): Observable<IEventStatusDetail> {
    return this.get<{ events: IEventStatusDetail }>(
      `/admin/events/${eventID}`
    ).pipe(map((response) => response.events));
  }
}
