export interface Property {
  id: string;
  name: string;
  ownerName: string;
  city: string;
  commissionRate: number; // Percentage (e.g., 15 or 20)
}

export enum Platform {
  Airbnb = 'Airbnb',
  Booking = 'Booking',
  Direct = 'Directo',
  Other = 'Otro'
}

export interface Reservation {
  id: string;
  propertyId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number; // Always stores the final calculated COP amount
  usdAmount?: number;  // Specific for Airbnb
  platform: Platform;
  notes?: string;
  paymentId?: string; // ID of the OwnerPayment record. If present, it's paid.
  
  // ===== NUEVOS CAMPOS SOLO PARA AIRBNB =====
  exchangeRate?: number; // Tasa COP/USD específica de esta reserva (ej: 4280.50)
  enteredAs?: 'COP' | 'USD'; // Cómo ingresó el usuario el monto originalmente
  // ===========================================
}

export interface OwnerPayment {
  id: string;
  ownerName: string;
  date: string; // YYYY-MM-DD
  amountPaid: number; // The manual amount entered by user
  expectedAmount: number; // The calculated sum of reservations
  reservationIds: string[]; // List of reservations covered
  notes?: string;
}

export interface MonthlyStats {
  totalRevenue: number;
  myEarnings: number;
  ownerPayouts: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// --- AI Actions ---

export type ActionType = 
  | 'ADD_PROPERTY' 
  | 'UPDATE_PROPERTY' 
  | 'DELETE_PROPERTY' 
  | 'ADD_RESERVATION' 
  | 'UPDATE_RESERVATION' 
  | 'DELETE_RESERVATION';

export interface AppAction {
  type: ActionType;
  payload: any;
}

// --- Cloud Types ---

export interface CloudConfig {
  apiKey: string; // X-Master-Key from JSONBin
  binId: string;  // Bin ID from JSONBin
  enabled: boolean;
}

export interface CloudStatus {
  lastSynced: string | null;
  isLoading: boolean;
  error: string | null;
}
