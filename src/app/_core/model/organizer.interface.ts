/** Opérateurs mobile money pris en charge (mêmes valeurs que `MobileMoneyProvider` côté API). */
export type MobileMoneyProvider = 'mvola' | 'orange_money' | 'airtel_money';

/** Compte mobile money d'une organisation. */
export interface IPaymentMethod {
    provider: MobileMoneyProvider;
    /** Numéro saisi (l'API le normalise en `+261XXXXXXXXX`). */
    phoneNumber: string;
    /** Nom du titulaire : celui que l'acheteur voit chez l'opérateur. */
    accountName: string;
}

export interface IOrganizer {
    /** Entier côté API (`Organizer::$id`), malgré l'ancien typage en chaîne. */
    id?: number;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

/** Une organisation vue depuis l'utilisateur : l'organisation, plus son rôle dedans. */
export interface IMyOrganizer extends IOrganizer {
    role?: string;
    roleLabel?: string;
    isOwner?: boolean;
    joinedAt?: string;
    /** Servi uniquement aux membres de l'organisation. */
    paymentMethods?: (IPaymentMethod & { providerLabel?: string })[];
}

/**
 * Corps de `/user/me/organizations` (dans `data`).
 *
 * `isSuperAdmin` compte autant que `items` : le rôle global n'ouvre aucune
 * appartenance, donc un super administrateur reçoit `items: []` alors qu'il a
 * accès à toutes les organisations. Sans ce drapeau, son sélecteur resterait vide.
 */
export interface IMyOrganizations {
    itemsTotal: number;
    isSuperAdmin: boolean;
    items: IMyOrganizer[];
}

/** Corps de `POST /organizers`. `name`, `email` et au moins un compte mobile money sont exigés par l'API. */
export interface ICreateOrganizerPayload {
    name: string;
    email: string;
    phone?: string | null;
    website?: string | null;
    paymentMethods: IPaymentMethod[];
}

/** Rôle d'un utilisateur dans une organisation (`OrganizerRole.php`). */
export type OrganizerRole = 'owner' | 'admin' | 'member';

/** Fiche complète (`GET /organizers/{id}`) : `role` est celui de l'appelant, absent pour un super administrateur. */
export interface IOrganizerDetail extends Omit<IMyOrganizer, 'createdAt' | 'updatedAt' | 'paymentMethods'> {
    paymentMethods: (IPaymentMethod & { providerLabel?: string })[];
    /** Dates ISO (le JSON ne porte pas de `Date`). */
    createdAt?: string;
    updatedAt?: string;
}

/** Corps de `PATCH /organizers/{id}` : n'importe quel sous-ensemble. */
export interface IUpdateOrganizerPayload {
    name?: string;
    email?: string;
    phone?: string | null;
    website?: string | null;
    paymentMethods?: IPaymentMethod[];
}

/** Membre d'une organisation (`GET /organizers/{id}/members`). */
export interface IOrganizerMember {
    userId: number;
    email: string;
    firstname?: string | null;
    lastname?: string | null;
    phone?: string | null;
    role: OrganizerRole;
    roleLabel: string;
    isOwner: boolean;
    joinedAt?: string;
}

/** Utilisateur proposé à l'invitation (`GET /organizers/{id}/member-candidates`). */
export interface IMemberCandidate {
    id: number;
    email: string;
    firstname?: string | null;
    lastname?: string | null;
}

export interface IOrganizerStats {
    organizer: { id: number; name: string };
    currency: string;
    generatedAt: string;
    events: {
        total: number;
        published: number;
        draft: number;
        upcoming: number;
        ongoing: number;
        past: number;
    };
    sales: {
        ordersPaid: number;
        ticketsSold: number;
        /** En ariary. */
        revenue: number;
        ordersByStatus: Record<string, number>;
    };
    series: {
        granularity: 'day' | 'month';
        from: string;
        to: string;
        points: IStatsPoint[];
    };
    topEvents: ITopEvent[];
}

export interface IStatsPoint {
    /** `AAAA-MM-JJ` ou `AAAA-MM` selon la granularité. */
    date: string;
    orders: number;
    ticketsSold: number;
    revenue: number;
}

export interface ITopEvent {
    id: number;
    title: string;
    ticketsSold: number;
    orders: number;
    revenue: number;
}

export interface IStatsQuery {
    granularity?: 'day' | 'month';
    from?: string;
    to?: string;
    top?: number;
}
