export type PaymentStatus = 'pending' | 'succeeded' | 'failed';
export type PaymentDirection = 'charge_company' | 'payout_recruiter';

export interface Payment {
  id: string;
  job_offer_id: string;
  headhunter_id: string;
  company_id: string;
  amount: string;
  currency: string;
  direction: PaymentDirection | null;
  psp_payment_id: string | null;
  status: PaymentStatus;
  created_at: string;
  updated_at: string;
}
