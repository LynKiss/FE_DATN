export const PAYMENT_METHOD_KEYS = [
  'cod',
  'bank_transfer',
  'momo',
  'vnpay',
  'zalopay',
] as const;

export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[number];

export type PaymentMethodConfig = {
  isActive: boolean;
  description: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  partnerCode?: string;
  accessKey?: string;
  secretKey?: string;
  tmnCode?: string;
  hashSecret?: string;
  appId?: string;
  key1?: string;
  key2?: string;
};

export type PaymentSettings = Record<PaymentMethodKey, PaymentMethodConfig>;

export type PublicPaymentMethodConfig = Pick<
  PaymentMethodConfig,
  'isActive' | 'description' | 'bankName' | 'accountNumber' | 'accountHolder'
>;

export type PublicPaymentSettings = Record<
  PaymentMethodKey,
  PublicPaymentMethodConfig
>;

export type SmtpConfig = {
  host: string;
  port: string;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
};

export type AdminCommerceSettings = {
  payments: PaymentSettings;
  smtp: SmtpConfig;
};

export type PublicCommerceSettings = {
  payments: PublicPaymentSettings;
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  cod: {
    isActive: true,
    description: 'Khách hàng thanh toán khi nhận hàng.',
  },
  bank_transfer: {
    isActive: true,
    description: 'Chuyển khoản ngân hàng và đợi xác nhận.',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  },
  momo: {
    isActive: false,
    description: 'Thanh toán qua ví MoMo.',
    partnerCode: '',
    accessKey: '',
    secretKey: '',
  },
  vnpay: {
    isActive: false,
    description: 'Thanh toán qua cổng VNPay.',
    tmnCode: '',
    hashSecret: '',
  },
  zalopay: {
    isActive: false,
    description: 'Thanh toán qua ví ZaloPay.',
    appId: '',
    key1: '',
    key2: '',
  },
};

export const DEFAULT_PUBLIC_PAYMENT_SETTINGS: PublicPaymentSettings = {
  cod: {
    isActive: DEFAULT_PAYMENT_SETTINGS.cod.isActive,
    description: DEFAULT_PAYMENT_SETTINGS.cod.description,
  },
  bank_transfer: {
    isActive: DEFAULT_PAYMENT_SETTINGS.bank_transfer.isActive,
    description: DEFAULT_PAYMENT_SETTINGS.bank_transfer.description,
    bankName: '',
    accountNumber: '',
    accountHolder: '',
  },
  momo: {
    isActive: DEFAULT_PAYMENT_SETTINGS.momo.isActive,
    description: DEFAULT_PAYMENT_SETTINGS.momo.description,
  },
  vnpay: {
    isActive: DEFAULT_PAYMENT_SETTINGS.vnpay.isActive,
    description: DEFAULT_PAYMENT_SETTINGS.vnpay.description,
  },
  zalopay: {
    isActive: DEFAULT_PAYMENT_SETTINGS.zalopay.isActive,
    description: DEFAULT_PAYMENT_SETTINGS.zalopay.description,
  },
};

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: '',
  port: '587',
  user: '',
  pass: '',
  from: '',
  secure: false,
};
