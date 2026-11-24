import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';

import { IOrganizerDetail } from '@/app/_core/model';
import { AuthService } from '@/app/_core/services/auth/auth.service';
import { OrganizerService } from '@/app/_core/services/organizer/organizer.service';
import { LoadingComponent } from '@/app/_shared/components/loading/loading.component';
import { OrganizerEventsComponent } from './components/organizer-events/organizer-events.component';
import { OrganizerInfoComponent } from './components/organizer-info/organizer-info.component';
import { OrganizerMembersComponent } from './components/organizer-members/organizer-members.component';
import { OrganizerStatsComponent } from './components/organizer-stats/organizer-stats.component';

type TabKey = 'info' | 'stats' | 'events' | 'members';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'info', label: 'Informations', icon: 'info' },
  { key: 'stats', label: 'Statistiques', icon: 'insights' },
  { key: 'events', label: 'Événements', icon: 'event' },
  { key: 'members', label: 'Membres', icon: 'groups' },
];

@Component({
  selector: 'app-organizer-detail',
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    LoadingComponent,
    OrganizerInfoComponent,
    OrganizerStatsComponent,
    OrganizerEventsComponent,
    OrganizerMembersComponent,
  ],
  templateUrl: './organizer-detail.component.html',
  host: { class: 'block h-full' },
})
export class OrganizerDetailComponent implements OnInit, OnDestroy {
  readonly tabs = TABS;
  tab: TabKey = 'info';

  organizerId!: number;
  organizer: IOrganizerDetail | null = null;
  isLoading = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private organizerService: OrganizerService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const tab = params.get('tab') as TabKey | null;
      this.tab = TABS.some((t) => t.key === tab) ? tab! : 'info';
    });

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.organizerId = Number(params.get('organizerId'));
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.isLoading = true;
    this.error = null;
    this.organizerService.getOrganizer(this.organizerId).subscribe({
      next: (organizer) => {
        this.organizer = organizer;
        this.isLoading = false;
      },
      error: (e) => {
        console.error("Erreur lors du chargement de l'organisateur:", e);
        this.organizer = null;
        this.isLoading = false;
        this.error =
          e?.status === 403
            ? "Vous n'avez pas accès à cette organisation."
            : e?.status === 404
              ? 'Organisation introuvable.'
              : "Impossible de charger l'organisation.";
      },
    });
  }

  selectTab(tab: TabKey): void {
    this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }

  /** Le super administrateur n'a pas d'appartenance (`role` nul) mais tous les droits. */
  get canEdit(): boolean {
    return this.auth.isSuperAdmin() || this.organizer?.role === 'owner' || this.organizer?.role === 'admin';
  }

  get isOwner(): boolean {
    return this.auth.isSuperAdmin() || this.organizer?.role === 'owner';
  }

  get currentUserId(): number | string | null {
    return this.auth.currentUser()?.id ?? null;
  }

  onUpdated(organizer: IOrganizerDetail): void {
    // Les dates et le rôle de l'appelant sont déjà dans la réponse du PATCH.
    this.organizer = organizer;
  }

  roleClasses(role: string | undefined): string {
    switch (role) {
      case 'owner':
        return 'bg-primary-50 text-primary-700 ring-primary-100';
      case 'admin':
        return 'bg-secondary-50 text-secondary-700 ring-secondary-100';
      default:
        return 'bg-gray-100 text-gray-600 ring-gray-200';
    }
  }

  roleIcon(role: string | undefined): string {
    return role === 'owner' ? 'workspace_premium' : role === 'admin' ? 'shield' : 'person';
  }

  initials(name: string | undefined): string {
    return (name ?? '?')
      .split(' ')
      .filter((part) => part.length > 0)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }
}
