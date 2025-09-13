export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELED';

export type Reservation = {
  id: string;
  createdAt: string;      // ISO
  date: string;           // 開催日 ISO
  slotLabel?: string;     // 枠名（例：10:00-11:00）
  partySize: number;      // 人数
  amount: number;         // 金額（税抜/税込は任意）
  currency?: string;      // 'jpy' など
  customerName?: string;  // 任意（ユーザー向けでは非表示でも可）
  status: ReservationStatus;
};

export type ReservationListResponse = {
  data: Reservation[];
  total: number;
  page: number;
  pageSize: number;
};
