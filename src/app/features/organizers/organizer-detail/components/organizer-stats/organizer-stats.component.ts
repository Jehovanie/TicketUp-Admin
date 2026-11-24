import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { IOrganizerStats, IStatsPoint } from '@/app/_core/model';
import { OrganizerService } from '@/app/_core/services/organizer/organizer.service';
import { LoadingComponent } from '@/app/_shared/components/loading/loading.component';
import { AriaryPipe } from '@/app/_shared/pipes/ariary.pipe';

type Metric = 'revenue' | 'ticketsSold' | 'orders';
type Granularity = 'day' | 'month';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'revenue', label: 'Revenus' },
  { key: 'ticketsSold', label: 'Billets' },
  { key: 'orders', label: 'Commandes' },
];

/** Couleur `primary` du thème (`styles.css`) : chart.js ne lit pas les classes Tailwind. */
const PRIMARY = '#121063';

@Component({
  selector: 'app-organizer-stats',
  imports: [CommonModule, RouterLink, MatIconModule, BaseChartDirective, LoadingComponent, AriaryPipe],
  templateUrl: './organizer-stats.component.html',
})
export class OrganizerStatsComponent implements OnChanges {
  @Input({ required: true }) organizerId!: number;

  readonly metrics = METRICS;
  metric: Metric = 'revenue';
  granularity: Granularity = 'day';

  stats: IOrganizerStats | null = null;
  isLoading = true;
  error: string | null = null;

  chartData: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  chartOptions: ChartConfiguration<'bar'>['options'] = { responsive: true, maintainAspectRatio: false };

  constructor(private organizerService: OrganizerService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['organizerId']) this.load();
  }

  load(): void {
    this.isLoading = true;
    this.error = null;
    this.organizerService.getOrganizerStats(this.organizerId, { granularity: this.granularity }).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.isLoading = false;
        this.buildChart();
      },
      error: (e) => {
        console.error('Erreur lors du chargement des statistiques:', e);
        this.error = e?.error?.message ?? 'Impossible de charger les statistiques.';
        this.isLoading = false;
      },
    });
  }

  setGranularity(granularity: Granularity): void {
    if (granularity === this.granularity) return;
    this.granularity = granularity;
    this.load();
  }

  setMetric(metric: Metric): void {
    this.metric = metric;
    this.buildChart();
  }

  get hasSales(): boolean {
    return (this.stats?.sales.ordersPaid ?? 0) > 0;
  }

  get hasSeriesActivity(): boolean {
    return (this.stats?.series.points ?? []).some((p) => p.orders > 0);
  }

  /** Part d'un événement dans le meilleur score, pour la barre du classement. */
  topShare(ticketsSold: number): number {
    const max = Math.max(...(this.stats?.topEvents ?? []).map((e) => e.ticketsSold), 1);
    return Math.round((ticketsSold / max) * 100);
  }

  private buildChart(): void {
    if (!this.stats) return;
    const points = this.stats.series.points;
    const label = METRICS.find((m) => m.key === this.metric)!.label;

    this.chartData = {
      labels: points.map((p) => this.formatBucket(p.date)),
      datasets: [
        {
          label,
          data: points.map((p: IStatsPoint) => p[this.metric]),
          backgroundColor: PRIMARY,
          borderRadius: 4,
          maxBarThickness: 28,
        },
      ],
    };
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
      },
    };
  }

  private formatBucket(date: string): string {
    const [y, m, d] = date.split('-').map(Number);
    return this.granularity === 'month'
      ? new Date(y, m - 1, 1).toLocaleDateString('fr', { month: 'short', year: '2-digit' })
      : new Date(y, m - 1, d).toLocaleDateString('fr', { day: 'numeric', month: 'short' });
  }
}
