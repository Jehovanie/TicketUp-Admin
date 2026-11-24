import { Injectable } from '@angular/core';
import { AppService } from '../AppService';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environements/environement';
import {
  IApiResponse,
  ICreateOrganizerPayload,
  IEvent,
  IMemberCandidate,
  IOrganizerDetail,
  IOrganizerMember,
  IOrganizerStats,
  IPaginated,
  IStatsQuery,
  IUpdateOrganizerPayload,
  OrganizerRole,
  IMyOrganizations,
  IMyOrganizer,
  IOrganizer,
} from '../../model';
import { map, Observable, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrganizerService extends AppService {

  constructor(httpClient: HttpClient) {
    super(httpClient, environment.apiUrl);
  }

  /** Liste complète, toutes pages confondues (l'API plafonne à 30 par page). */
  getAllOrganizers(): Observable<IOrganizer[]> {
    return this.getAllPages<IOrganizer>('/organizers');
  }

  /**
   * Organisations de l'utilisateur connecté, avec son rôle dans chacune.
   *
   * Contrairement à `/organizers` (API Platform, tableau nu ou Hydra), cet
   * endpoint passe par un contrôleur maison et renvoie l'enveloppe
   * `{ message, status, data }` : il faut la déballer, pas la paginer.
   *
   * Le super administrateur n'appartient à aucune organisation — son rôle est
   * global — et reçoit donc `items: []` ; on bascule alors sur la liste complète,
   * sinon il ne pourrait choisir aucun organisateur.
   */
  getMyOrganizers(): Observable<IMyOrganizer[]> {
    return this.get<IApiResponse<IMyOrganizations>>(
      '/user/me/organizations'
    ).pipe(
      switchMap(({ data }) =>
        data.isSuperAdmin ? this.getAllOrganizers() : of(data.items)
      )
    );
  }

  /**
   * Même appel, réponse brute — `isSuperAdmin` compris.
   *
   * La page « Organisateurs » a besoin de distinguer « vous n'appartenez à
   * aucune organisation » de « votre rôle est global » : le repli silencieux de
   * `getMyOrganizers()` effacerait justement cette nuance, et les organisations
   * de repli arrivent sans rôle, qui est le sujet de la page.
   */
  getMyOrganizations(): Observable<IMyOrganizations> {
    return this.get<IApiResponse<IMyOrganizations>>(
      '/user/me/organizations'
    ).pipe(map((response) => response.data));
  }

  /**
   * Crée une organisation dont l'appelant devient responsable.
   *
   * L'API rattache le créateur dans la même transaction : l'organisation est
   * donc immédiatement visible dans `getMyOrganizations()`.
   */
  createOrganizer(payload: ICreateOrganizerPayload): Observable<IMyOrganizer> {
    return this.post<IApiResponse<IMyOrganizer>>('/organizers', payload).pipe(
      map((response) => response.data)
    );
  }

  /** Fiche complète, réservée aux membres (comptes mobile money et rôle de l'appelant compris). */
  getOrganizer(id: number): Observable<IOrganizerDetail> {
    return this.get<IApiResponse<IOrganizerDetail>>(`/organizers/${id}`).pipe(
      map((response) => response.data)
    );
  }

  /** Modification partielle ; `paymentMethods`, s'il est envoyé, remplace la liste entière. */
  updateOrganizer(id: number, payload: IUpdateOrganizerPayload): Observable<IOrganizerDetail> {
    return this.patch<IApiResponse<IOrganizerDetail>>(`/organizers/${id}`, payload).pipe(
      map((response) => response.data)
    );
  }

  /** Événements de l'organisation, brouillons compris. */
  getOrganizerEvents(
    id: number,
    page = 1,
    itemsPerPage = 12,
    filters: { status?: 'published' | 'draft'; period?: 'upcoming' | 'ongoing' | 'past' } = {}
  ): Observable<IPaginated<IEvent>> {
    let params = new HttpParams().set('page', page).set('itemsPerPage', itemsPerPage);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.period) params = params.set('period', filters.period);
    return this.get<IApiResponse<IPaginated<IEvent>>>(`/organizers/${id}/events`, params).pipe(
      map((response) => response.data)
    );
  }

  getOrganizerStats(id: number, query: IStatsQuery = {}): Observable<IOrganizerStats> {
    let params = new HttpParams();
    if (query.granularity) params = params.set('granularity', query.granularity);
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.top) params = params.set('top', query.top);
    return this.get<IApiResponse<IOrganizerStats>>(`/organizers/${id}/stats`, params).pipe(
      map((response) => response.data)
    );
  }

  getMembers(id: number): Observable<IOrganizerMember[]> {
    return this.get<IApiResponse<{ items: IOrganizerMember[] }>>(`/organizers/${id}/members`).pipe(
      map((response) => response.data.items)
    );
  }

  /** Recherche d'utilisateurs à inviter : l'API exige au moins 3 caractères. */
  searchMemberCandidates(id: number, term: string): Observable<IMemberCandidate[]> {
    const params = new HttpParams().set('q', term);
    return this.get<IApiResponse<{ items: IMemberCandidate[] }>>(
      `/organizers/${id}/member-candidates`,
      params
    ).pipe(map((response) => response.data.items));
  }

  addMember(id: number, userId: number, role: OrganizerRole): Observable<IOrganizerMember> {
    return this.post<IApiResponse<IOrganizerMember>>(`/organizers/${id}/members`, { userId, role }).pipe(
      map((response) => response.data)
    );
  }

  updateMemberRole(id: number, userId: number, role: OrganizerRole): Observable<IOrganizerMember> {
    return this.patch<IApiResponse<IOrganizerMember>>(`/organizers/${id}/members/${userId}`, { role }).pipe(
      map((response) => response.data)
    );
  }

  removeMember(id: number, userId: number): Observable<void> {
    return this.remove<IApiResponse<null>>(`/organizers/${id}/members/${userId}`).pipe(map(() => void 0));
  }

  /** Transfère la responsabilité ; l'ancien responsable devient administrateur. */
  transferOwnership(id: number, userId: number): Observable<IOrganizerMember[]> {
    return this.put<IApiResponse<{ members: IOrganizerMember[] }>>(`/organizers/${id}/owner`, { userId }).pipe(
      map((response) => response.data.members)
    );
  }
}
