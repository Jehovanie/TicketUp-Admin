import { MobileMoneyProvider } from '@/app/_core/model';

/** Un opérateur et les préfixes (après le `0` national) qu'il attribue — voir `MobileMoneyProvider.php`. */
export interface IProviderOption {
  provider: MobileMoneyProvider;
  label: string;
  /** Fichier servi depuis `public/logos/`. */
  logo: string;
  prefixes: string[];
  placeholder: string;
}

/** Saisie d'un compte : `enabled` décide s'il part dans la requête. */
export interface IPaymentEntry {
  enabled: boolean;
  phoneNumber: string;
  accountName: string;
}

export type PaymentEntries = Record<MobileMoneyProvider, IPaymentEntry>;

export const PROVIDER_OPTIONS: IProviderOption[] = [
  { provider: 'mvola', label: 'MVola', logo: '/logos/mvola.jpg', prefixes: ['34', '38'], placeholder: '034 12 345 67' },
  { provider: 'orange_money', label: 'Orange Money', logo: '/logos/orangemoney.png', prefixes: ['32', '37'], placeholder: '032 12 345 67' },
  { provider: 'airtel_money', label: 'Airtel Money', logo: '/logos/airtelmoney.png', prefixes: ['33'], placeholder: '033 12 345 67' },
];

export const emptyPaymentEntries = (): PaymentEntries => ({
  mvola: { enabled: false, phoneNumber: '', accountName: '' },
  orange_money: { enabled: false, phoneNumber: '', accountName: '' },
  airtel_money: { enabled: false, phoneNumber: '', accountName: '' },
});

/**
 * Même contrôle que l'API (`normalizePhone`) : numéro malgache à 10 chiffres
 * dont l'indicatif appartient à l'opérateur — évite d'enregistrer un numéro
 * Airtel sous « MVola ».
 */
export function isValidMobileMoneyPhone(provider: MobileMoneyProvider, raw: string): boolean {
  const digits = raw.replace(/[\s.\-()]/g, '');
  let national = digits;
  if (digits.startsWith('+261')) national = '0' + digits.slice(4);
  else if (digits.startsWith('00261')) national = '0' + digits.slice(5);
  else if (digits.startsWith('261')) national = '0' + digits.slice(3);

  if (!/^0\d{9}$/.test(national)) return false;
  const option = PROVIDER_OPTIONS.find((o) => o.provider === provider);
  return !!option && option.prefixes.includes(national.slice(1, 3));
}

export function isValidAccountName(raw: string): boolean {
  const value = raw.trim();
  return value.length > 0 && value.length <= 100;
}
