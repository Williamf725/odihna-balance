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