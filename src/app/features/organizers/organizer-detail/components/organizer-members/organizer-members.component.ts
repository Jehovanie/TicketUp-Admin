import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap, takeUntil, catchError } from 'rxjs';

import { IMemberCandidate, IOrganizerMember, OrganizerRole } from '@/app/_core/model';
import { OrganizerService } from '@/app/_core/services/organizer/organizer.service';
import { LoadingComponent } from '@/app/_shared/components/loading/loading.component';
import { NotificationService } from '@/app/_shared/services/notification.service';

type PendingAction = { userId: number; kind: 'remove' | 'transfer' };

/** Seuil imposé par l'API (`member-candidates`). */
const MIN_SEARCH_LENGTH = 3;

@Component({
  selector: 'app-organizer-members',
  imports: [MatTooltipModule, CommonModule, FormsModule, MatIconModule, LoadingComponent],
  templateUrl: './organizer-members.component.html',
})
export class OrganizerMembersComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) organizerId!: number;
  /** Administrateur ou plus : invite, change les rôles, retire. */
  @Input() canManage = false;
  /** Responsable : seul à pouvoir transférer la responsabilité. */
  @Input() isOwner = false;
  /** Pour ne pas proposer à quelqu'un de se retirer lui-même. */
  @Input() currentUserId: number | string | null = null;

  /** Mon rôle a changé : la page recharge la fiche pour mettre à jour droits et en-tête. */
  @Output() transferred = new EventEmitter<void>();

  members: IOrganizerMember[] = [];
  isLoading = true;
  error: string | null = null;

  readonly minSearchLength = MIN_SEARCH_LENGTH;
  searchTerm = '';
  candidates: IMemberCandidate[] = [];
  isSearching = false;
  selectedCandidate: IMemberCandidate | null = null;
  newRole: OrganizerRole = 'member';
  isAdding = false;

  pending: PendingAction | null = null;
  busyUserId: number | null = null;

  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(private organizerService: OrganizerService, private notification: NotificationService) {}

  ngOnInit(): void {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (term.length < MIN_SEARCH_LENGTH) {
            this.isSearching = false;
            return of([] as IMemberCandidate[]);
          }
          this.isSearching = true;
          return this.organizerService
            .searchMemberCandidates(this.organizerId, term)
            .pipe(catchError(() => of([] as IMemberCandidate[])));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((candidates) => {
        this.isSearching = false;
        this.candidates = candidates;
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['organizerId']) this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.isLoading = true;
    this.error = null;
    this.organizerService.getMembers(this.organizerId).subscribe({
      next: (members) => {
        this.members = members;
        this.isLoading = false;
      },
      error: (e) => {
        console.error('Erreur lors du chargement des membres:', e);
        this.error = e?.error?.message ?? 'Impossible de charger les membres.';
        this.isLoading = false;
      },
    });
  }

  fullName(member: { firstname?: string | null; lastname?: string | null; email: string }): string {
    const name = [member.firstname, member.lastname].filter(Boolean).join(' ');
    return name || member.email;
  }

  initials(member: { firstname?: string | null; lastname?: string | null; email: string }): string {
    return this.fullName(member)
      .split(' ')
      .filter((p) => p.length > 0)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
  }

  /** Même encodage des rôles que la liste des organisateurs. */
  roleClasses(role: string): string {
    switch (role) {
      case 'owner':
        return 'bg-primary-50 text-primary-700 ring-primary-100';
      case 'admin':
        return 'bg-secondary-50 text-secondary-700 ring-secondary-100';
      default:
        return 'bg-gray-100 text-gray-600 ring-gray-200';
    }
  }

  roleIcon(role: string): string {
    return role === 'owner' ? 'workspace_premium' : role === 'admin' ? 'shield' : 'person';
  }

  isSelf(member: IOrganizerMember): boolean {
    return this.currentUserId !== null && String(member.userId) === String(this.currentUserId);
  }

  /** Le rôle d'un responsable ne se change que par transfert de responsabilité. */
  canChangeRole(member: IOrganizerMember): boolean {
    return this.canManage && member.role !== 'owner' && !this.isSelf(member);
  }

  canRemove(member: IOrganizerMember): boolean {
    return this.canManage && member.role !== 'owner' && !this.isSelf(member);
  }

  canTransfer(member: IOrganizerMember): boolean {
    return this.isOwner && member.role !== 'owner' && !this.isSelf(member);
  }

  onSearch(term: string): void {
    this.searchTerm = term;
    this.selectedCandidate = null;
    this.search$.next(term.trim());
    if (term.trim().length < MIN_SEARCH_LENGTH) this.candidates = [];
  }

  selectCandidate(candidate: IMemberCandidate): void {
    this.selectedCandidate = candidate;
    this.searchTerm = candidate.email;
    this.candidates = [];
  }

  addMember(): void {
    if (!this.selectedCandidate || this.isAdding) return;
    const candidate = this.selectedCandidate;
    this.isAdding = true;
    this.organizerService.addMember(this.organizerId, candidate.id, this.newRole).subscribe({
      next: () => {
        this.isAdding = false;
        this.notification.success(`${this.fullName(candidate)} a été ajouté.`, 'Membre ajouté');
        this.searchTerm = '';
        this.selectedCandidate = null;
        this.newRole = 'member';
        this.load();
      },
      error: (e) => {
        this.isAdding = false;
        this.notification.error(e?.error?.message ?? "Impossible d'ajouter ce membre.", "Échec de l'ajout");
      },
    });
  }

  changeRole(member: IOrganizerMember, role: OrganizerRole): void {
    if (role === member.role) return;
    this.busyUserId = member.userId;
    this.organizerService.updateMemberRole(this.organizerId, member.userId, role).subscribe({
      next: (updated) => {
        this.busyUserId = null;
        this.members = this.members.map((m) => (m.userId === updated.userId ? updated : m));
        this.notification.success(`${this.fullName(member)} est désormais ${updated.roleLabel.toLowerCase()}.`, 'Rôle modifié');
      },
      error: (e) => {
        this.busyUserId = null;
        // Recharge : le sélecteur affiche sinon une valeur que le serveur a refusée.
        this.load();
        this.notification.error(e?.error?.message ?? 'Impossible de modifier ce rôle.', 'Échec de la modification');
      },
    });
  }

  ask(userId: number, kind: PendingAction['kind']): void {
    this.pending = { userId, kind };
  }

  isPending(userId: number, kind: PendingAction['kind']): boolean {
    return this.pending?.userId === userId && this.pending.kind === kind;
  }

  confirmRemove(member: IOrganizerMember): void {
    this.busyUserId = member.userId;
    this.organizerService.removeMember(this.organizerId, member.userId).subscribe({
      next: () => {
        this.busyUserId = null;
        this.pending = null;
        this.members = this.members.filter((m) => m.userId !== member.userId);
        this.notification.success(`${this.fullName(member)} a été retiré.`, 'Membre retiré');
      },
      error: (e) => {
        this.busyUserId = null;
        this.pending = null;
        this.notification.error(e?.error?.message ?? 'Impossible de retirer ce membre.', 'Échec du retrait');
      },
    });
  }

  confirmTransfer(member: IOrganizerMember): void {
    this.busyUserId = member.userId;
    this.organizerService.transferOwnership(this.organizerId, member.userId).subscribe({
      next: (members) => {
        this.busyUserId = null;
        this.pending = null;
        this.members = members;
        this.notification.success(
          `${this.fullName(member)} est désormais responsable. Vous devenez administrateur.`,
          'Responsabilité transférée'
        );
        this.transferred.emit();
      },
      error: (e) => {
        this.busyUserId = null;
        this.pending = null;
        this.notification.error(e?.error?.message ?? 'Impossible de transférer la responsabilité.', 'Échec du transfert');
      },
    });
  }
}
