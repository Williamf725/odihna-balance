import React, { useState, useEffect, useMemo, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatBot from './components/ChatBot';
import VoiceCommandModal from './components/VoiceCommandModal';
import PropertyModal from './components/PropertyModal';
import ReservationModal from './components/ReservationModal';
import PaymentsView from './components/PaymentsView'; // IMPORT NEW COMPONENT
import { Property, Reservation, Platform, AppAction, CloudConfig, CloudStatus, OwnerPayment, ReservationType } from './types';

import { uploadToCloud, downloadFromCloud } from './services/cloudService';
import { processExcelFile } from './services/excelService'; // IMPORT EXCEL SERVICE
import { 
  Plus, TrendingUp, Users, DollarSign, 
  Trash2, Mic, Calendar as CalendarIcon, MapPin, Pencil, Moon, Building2, Search, X,
  CalendarRange, AlertTriangle, CheckSquare, Square, Filter, User, Lock, LogOut, ArrowRight, ChevronLeft, Calendar,
  BarChart, PieChart, Download, Upload, Settings, FileJson, RefreshCw, Copy, Check, Cloud, Wifi, WifiOff, Save, KeyRound, Unlock, Globe, ArrowDownUp, RefreshCcw, ExternalLink, Loader2, FileSpreadsheet
} from 'lucide-react';
import { 
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, Legend
} from 'recharts';

// --- Helper: Currency Formatter (COP) ---
const formatCOP = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// --- Helper: Month Formatter ---
const formatMonthYear = (yyyyMm: string) => {
    if (!yyyyMm) return '';
    const [year, month] = yyyyMm.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
};

// --- Helper: Robust ID Generator ---
export const generateId = () => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {}
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// --- Colors ---
const COLORS = [
  '#0ea5e9', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#6366f1', '#84cc16', '#14b8a6'
];

const getColorForId = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
};

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// --- Auth Types ---
type UserRole = 'admin' | 'owner' | null;
interface UserState {
    role: UserRole;
    propertyId?: string; // Only for owners
}

// --- AutoSave Status Type ---
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

function App() {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<UserState>({ role: null });
  const [loginStep, setLoginStep] = useState<'selection' | 'admin' | 'owner'>('selection');
  const [loginCode, setLoginCode] = useState('');
  const [selectedOwnerPropId, setSelectedOwnerPropId] = useState('');
  const [authError, setAuthError] = useState('');

  // --- App State ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Modals
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isPropertyModalOpen, setIsPropertyModalOpen] = useState(false);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  
  // Filter States
  const [propertySearch, setPropertySearch] = useState('');
  const [reservationSearch, setReservationSearch] = useState('');
  const [dateFilterStart, setDateFilterStart] = useState('');
  const [dateFilterEnd, setDateFilterEnd] = useState('');
  
  // Global Month Filter (Dashboard & General Reports)
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // --- Exchange Rate State ---
  const [marketExchangeRate, setMarketExchangeRate] = useState(4100); // Default safe value
  const [isRateLoading, setIsRateLoading] = useState(false);
  const [lastRateUpdate, setLastRateUpdate] = useState<string>('');
  const [rateSource, setRateSource] = useState<string>('Esperando...');

  const [manualExchangeRate, setManualExchangeRate] = useState<number>(() => {
      const saved = localStorage.getItem('gestor_pro_manual_usd_rate');
      return saved ? parseFloat(saved) : 3900;
  });

  // Report States
  const [reportSubTab, setReportSubTab] = useState<'general' | 'custom'>('general');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [excludedReservationIds, setExcludedReservationIds] = useState<Set<string>>(new Set());
  // ✅ NUEVO: Control de tasa para liquidación final
const [useLiquidationRate, setUseLiquidationRate] = useState(false);
const [liquidationRateType, setLiquidationRateType] = useState<'manual' | 'trm'>('manual');
  // ✅ NUEVO: Estados para recálculo de tasa Airbnb en reportes personalizados
const [useCustomRateForPayouts, setUseCustomRateForPayouts] = useState(false);
const [payoutRateSource, setPayoutRateSource] = useState<'manual' | 'trm'>('manual');
 
  // Editing State
  const [editingProperty, setEditingProperty] = useState<Property | undefined>(undefined);
  const [editingReservation, setEditingReservation] = useState<Reservation | undefined>(undefined);

  // Helper state for copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Hidden File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null); // NEW REF for Excel

  // --- Cloud Sync State ---
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(() => {
      try {
          const saved = localStorage.getItem('gestor_pro_cloud_config');
          const defaultCloud = { 
            apiKey: '$2a$10$vHUyWJGFqcy0m7D5Ox/p8ewm3T0PSe0F1JaHZ/bKSoXFg5KN26PwS', 
            binId: '696822a943b1c97be9310eae', 
            enabled: true 
          };

          if (saved) {
              const parsed = JSON.parse(saved);
              return {
                  apiKey: parsed.apiKey || defaultCloud.apiKey,
                  binId: parsed.binId || defaultCloud.binId,
                  enabled: true 
              };
          }
          return defaultCloud;
      } catch (e) { 
          return { 
            apiKey: '$2a$10$vHUyWJGFqcy0m7D5Ox/p8ewm3T0PSe0F1JaHZ/bKSoXFg5KN26PwS', 
            binId: '696822a943b1c97be9310eae', 
            enabled: true 
          }; 
      }
  });

  const [isEditingCloudConfig, setIsEditingCloudConfig] = useState(false); 

  const [cloudStatus, setCloudStatus] = useState<CloudStatus>({
      lastSynced: localStorage.getItem('gestor_pro_last_synced'),
      isLoading: false,
      error: null
  });

  const [saveState, setSaveState] = useState<SaveState>('idle');
  
  // Data Persistence - GUARDED AGAINST UNDEFINED
  const [properties, setProperties] = useState<Property[]>(() => {
    try {
        const saved = localStorage.getItem('gestor_pro_properties');
        if (!saved || saved === "undefined") return []; // Critical Check
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  });
  
  const [reservations, setReservations] = useState<Reservation[]>(() => {
    try {
        const saved = localStorage.getItem('gestor_pro_reservations');
        if (!saved || saved === "undefined") return []; // Critical Check
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  });

  // NEW: Payments State
  const [payments, setPayments] = useState<OwnerPayment[]>(() => {
      try {
          const saved = localStorage.getItem('gestor_pro_payments');
          if (!saved || saved === "undefined") return [];
          const parsed = JSON.parse(saved);
          return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
  });

  // Track if it's the first render to avoid auto-saving on mount
  const isFirstRender = useRef(true);
  
  // Track if we have already attempted auto-load to prevent double calls
  const hasAutoLoaded = useRef(false);

  // FLAG: Prevents Auto-Save from firing immediately after a Download
  const isRemoteUpdate = useRef(false);

  // --- Effects ---
  useEffect(() => {
    if (properties) {
        localStorage.setItem('gestor_pro_properties', JSON.stringify(properties));
    }
  }, [properties]);

  useEffect(() => {
    if (reservations) {
        localStorage.setItem('gestor_pro_reservations', JSON.stringify(reservations));
    }
  }, [reservations]);

  // NEW: Payments Persistence
  useEffect(() => {
      if (payments) {
          localStorage.setItem('gestor_pro_payments', JSON.stringify(payments));
      }
  }, [payments]);

  useEffect(() => {
      localStorage.setItem('gestor_pro_cloud_config', JSON.stringify(cloudConfig));
  }, [cloudConfig]);

  useEffect(() => {
      localStorage.setItem('gestor_pro_manual_usd_rate', manualExchangeRate.toString());
  }, [manualExchangeRate]);

  // --- OFFICIAL TRM FETCHING ---
  const fetchMarketRate = async () => {
      setIsRateLoading(true);
      setRateSource('Consultando TRM...');
      
      const updateRate = (rate: number, source: string) => {
          setMarketExchangeRate(rate);
          setRateSource(source);
          setLastRateUpdate(new Date().toLocaleTimeString('es-CO', {hour: '2-digit', minute:'2-digit'}));
          setIsRateLoading(false);
      };

      // 1. Official Government Data (TRM) - Most Reliable in Colombia
      try {
          // Datos Abiertos Colombia Socrata API
          const resGov = await fetch(`https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciahasta%20DESC`);
          if (resGov.ok) {
              const dataGov = await resGov.json();
              if (dataGov?.[0]?.valor) {
                  updateRate(parseFloat(dataGov[0].valor), 'TRM Oficial (Gov.co)');
                  return;
              }
          }
      } catch (e) { console.warn("TRM Gov fetch failed", e); }

      // 2. Fallback: ExchangeRate-API (Standard FX)
      try {
           const resFallback = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
           const dataFallback = await resFallback.json();
           if (dataFallback.rates.COP) {
               updateRate(dataFallback.rates.COP, 'Tasa Global (Est.)');
               return;
           }
      } catch (e) {
          console.error("All rate sources failed");
          setRateSource('Manual / Error');
          setIsRateLoading(false);
      }
  };

  useEffect(() => {
      fetchMarketRate();
      // Removed automatic interval. TRM is daily, better to let user refresh manually if needed.
  }, []);


  // --- AUTO-LOAD EFFECT (New) ---
  useEffect(() => {
      // If enabled and has credentials, and hasn't loaded this session
      if (cloudConfig.enabled && cloudConfig.apiKey && cloudConfig.binId && !hasAutoLoaded.current) {
          hasAutoLoaded.current = true;
          // Trigger silent download
          handleCloudSync('download', true);
      }
  }, [cloudConfig.enabled, cloudConfig.apiKey, cloudConfig.binId]); // Dependencies imply config readiness


  // --- AUTO-SAVE EFFECT (FIXED) ---
  useEffect(() => {
    // 1. Don't save if not configured
    if (!cloudConfig.apiKey || !cloudConfig.binId || !cloudConfig.enabled) return;

    // 2. Skip first render to prevent overwriting cloud with stale local state on init
    if (isFirstRender.current) {
        isFirstRender.current = false;
        return;
    }

    // 3. REMOTE UPDATE CHECK:
    // If this change was caused by a cloud download, DO NOT upload it back.
    if (isRemoteUpdate.current) {
        console.log("Auto-save skipped: Update came from cloud.");
        isRemoteUpdate.current = false; // Reset for next valid user change
        return;
    }

    // 4. SAFETY CHECK: Don't auto-save if everything is empty. 
    // This prevents a "New Device" or "Clear Cache" scenario from wiping the Cloud.
    if (properties.length === 0 && reservations.length === 0) {
        console.warn("Auto-save aborted: Local state is empty. Manual sync required to prevent data loss.");
        return;
    }
    
    // 5. Don't save if we are currently loading/downloading
    if (cloudStatus.isLoading) return;

    setSaveState('pending');

    // REDUCED DEBOUNCE TO 1000ms (1 second) for faster response
    const debounceTimer = setTimeout(async () => {
        setSaveState('saving');
        try {
            const result = await uploadToCloud(cloudConfig, { properties, reservations, payments }); // Add payments to upload
            if (result.success) {
                const now = new Date().toLocaleString();
                localStorage.setItem('gestor_pro_last_synced', now);
                setCloudStatus(prev => ({ ...prev, lastSynced: now, error: null }));
                setSaveState('saved');
                setTimeout(() => setSaveState('idle'), 3000);
            } else {
                setSaveState('error');
            }
        } catch (e) {
            setSaveState('error');
        }
    }, 1000); // Wait 1 second after last change before uploading

    return () => clearTimeout(debounceTimer);
  }, [properties, reservations, payments, cloudConfig.apiKey, cloudConfig.binId, cloudConfig.enabled]); 

  // --- BROWSER CLOSE PROTECTION ---
  // If the user tries to close the tab while saving, warn them.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (saveState === 'pending' || saveState === 'saving') {
            e.preventDefault();
            e.returnValue = ''; // Legacy support for older browsers
            return 'Hay cambios sin guardar en la nube. ¿Seguro que quieres salir?';
        }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveState]);


  // --- Cloud Logic (Manual/Auto) ---
  const handleCloudSync = async (direction: 'upload' | 'download', silent: boolean = false) => {
      setCloudStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
          if (direction === 'upload') {
              // Manual upload overrides safety checks (user knows what they are doing)
              const result = await uploadToCloud(cloudConfig, { properties, reservations, payments });
              if (result.success) {
                  const now = new Date().toLocaleString();
                  localStorage.setItem('gestor_pro_last_synced', now);
                  setCloudStatus(prev => ({ ...prev, lastSynced: now, isLoading: false }));
                  setSaveState('saved');
                  if (!silent) alert(result.message || "Sincronización completada.");
              } else {
                  throw new Error(result.message);
              }
          } else {
              const result = await downloadFromCloud(cloudConfig);
              if (result.success && result.data) {
                  // !!! IMPORTANT !!!
                  // Set this flag BEFORE setting state.
                  // This tells the Auto-Save effect: "Ignore the next update, it's just a download."
                  isRemoteUpdate.current = true;

                  // Safety: Ensure we don't set undefined, which breaks localStorage JSON.parse
                  setProperties(Array.isArray(result.data.properties) ? result.data.properties : []);
                  setReservations(Array.isArray(result.data.reservations) ? result.data.reservations : []);
                  setPayments(Array.isArray(result.data.payments) ? result.data.payments : []);
                  
                  const now = new Date().toLocaleString();
                  localStorage.setItem('gestor_pro_last_synced', now);
                  setCloudStatus(prev => ({ ...prev, lastSynced: now, isLoading: false }));
                  if (!silent) alert("Datos descargados y actualizados desde la nube.");
              } else {
                  throw new Error(result.message);
              }
          }
      } catch (error: any) {
          setCloudStatus(prev => ({ ...prev, isLoading: false, error: error.message }));
          if (silent) console.error("Auto-download failed:", error.message);
      }
  };


  // --- Helpers ---
  const isAdmin = currentUser.role === 'admin';
  const isOwner = currentUser.role === 'owner';

  const visibleProperties = useMemo(() => {
      if (isOwner && currentUser.propertyId) {
          return properties.filter(p => p.id === currentUser.propertyId);
      }
      return properties;
  }, [properties, currentUser]);

  const visibleReservations = useMemo(() => {
      if (isOwner && currentUser.propertyId) {
          return reservations.filter(r => r.propertyId === currentUser.propertyId);
      }
      return reservations;
  }, [reservations, currentUser]);
  
  const monthlyReservations = useMemo(() => {
      return visibleReservations.filter(r => r.checkInDate.startsWith(currentMonth));
  }, [visibleReservations, currentMonth]);

  // Helper for Airbnb logic: Compare rates and pick the one that benefits the user (lower payout)
 const getAirbnbCopValue = (res: Reservation) => {
    // Para NO-Airbnb, siempre usar totalAmount
    if (res.platform !== Platform.Airbnb) return res.totalAmount;
    
    // Para Airbnb: Si tiene tasa específica, usarla
    if (res.exchangeRate && res.usdAmount) {
        return res.usdAmount * res.exchangeRate;
    }
    
    // Fallback para reservas antiguas sin exchangeRate (compatibilidad)
    if (res.usdAmount) {
        const effectiveRate = Math.min(manualExchangeRate, marketExchangeRate > 0 ? marketExchangeRate : manualExchangeRate);
        return res.usdAmount * effectiveRate;
    }
    
    // Si solo tiene totalAmount
    return res.totalAmount;
};

  // Helper para mostrar detalles de Airbnb en reportes
const getAirbnbDetails = (res: Reservation) => {
    if (res.platform !== Platform.Airbnb) return null;
    
    return {
        usd: res.usdAmount || 0,
        cop: res.totalAmount || 0,
        rate: res.exchangeRate || 0,
        enteredAs: res.enteredAs || 'USD',
        calculatedCop: getAirbnbCopValue(res)
    };
};

  
  const getAirbnbEffectiveRate = () => Math.min(manualExchangeRate, marketExchangeRate > 0 ? marketExchangeRate : manualExchangeRate);
  
// ✅ NUEVO: Helper para recalcular pago a dueño con tasa diferente
const recalculateAirbnbPayout = (res: Reservation, prop: Property) => {
  // Solo aplica a Airbnb con USD
  if (res.platform !== Platform.Airbnb || !res.usdAmount) {
    return null; // No aplica recálculo
  }

  // Tasa original con la que se registró
  const originalRate = res.exchangeRate || 0;
  const originalCOP = res.usdAmount * originalRate;
  
  // Tasa de pago (la que el admin configura para pagar)
  const payoutRate = payoutRateSource === 'trm' 
    ? marketExchangeRate 
    : manualExchangeRate;
  
  // Recalcular COP con la nueva tasa
  const recalculatedCOP = res.usdAmount * payoutRate;
  
  // Comisión se calcula sobre el ORIGINAL
  const commission = originalCOP * (prop.commissionRate / 100);
  
  // Pago al dueño con tasa de pago
  const ownerPayoutOriginal = originalCOP - commission;
  const ownerPayoutRecalculated = recalculatedCOP - commission;
  
  // Diferencia (ganancia/pérdida por cambio de tasa)
  const rateDifference = recalculatedCOP - originalCOP;
  
  return {
    originalRate,
    payoutRate,
    originalCOP,
    recalculatedCOP,
    commission,
    ownerPayoutOriginal,
    ownerPayoutRecalculated,
    rateDifference,
    usdAmount: res.usdAmount
  };
};

  // ✅✅✅ AQUÍ VA EL PASO 2 (NUEVA FUNCIÓN) ✅✅✅
// NUEVO: Calcula la liquidación final con tasa personalizada
const calculateLiquidation = (ownerStats: Record<string, any>) => {
  if (!useLiquidationRate) return null;

  const liquidationRate = liquidationRateType === 'trm' ? marketExchangeRate : manualExchangeRate;
  const result: Record<string, {
    originalPayout: number;
    liquidationPayout: number;
    difference: number;
    airbnbCount: number;
  }> = {};

  Object.entries(ownerStats).forEach(([owner, data]: [string, any]) => {
    let originalPayout = 0;
    let liquidationPayout = 0;
    let airbnbCount = 0;

    data.reservations.forEach((item: any) => {
      if (item.isExcluded) return;

      const res = item.res;
      const prop = visibleProperties.find(p => p.id === res.propertyId);
      if (!prop) return;

      // Solo procesar Airbnb con USD
      if (res.platform === Platform.Airbnb && res.usdAmount) {
        airbnbCount++;

        // Cálculo con tasa ORIGINAL
        const originalCOP = res.usdAmount * (res.exchangeRate || 0);
        const commission = originalCOP * (prop.commissionRate / 100);
        originalPayout += (originalCOP - commission);

        // Cálculo con tasa de LIQUIDACIÓN
        const liquidationCOP = res.usdAmount * liquidationRate;
        const liquidationCommission = liquidationCOP * (prop.commissionRate / 100);
        liquidationPayout += (liquidationCOP - liquidationCommission);
      } else {
        // Para no-Airbnb, usar valor original (sin cambios)
        originalPayout += item.calculatedCop - item.commission;
        liquidationPayout += item.calculatedCop - item.commission;
      }
    });

    result[owner] = {
      originalPayout,
      liquidationPayout,
      difference: liquidationPayout - originalPayout,
      airbnbCount
    };
  });

  return result;
};

  const handleSaveProperty = (prop: Property) => {
    setSaveState('pending'); // Immediate feedback
    if (editingProperty) {
      setProperties(properties.map(p => p.id === prop.id ? prop : p));
    } else {
      setProperties([...properties, prop]);
    }
    setEditingProperty(undefined);
  };
  
  const deleteProperty = (id: string) => {
      setSaveState('pending'); // Immediate feedback
      setProperties(properties.filter(p => p.id !== id));
  };
  
  const handleSaveReservation = (res: Reservation) => {
    setSaveState('pending'); // Immediate feedback
    if (editingReservation) {
      setReservations(reservations.map(r => r.id === res.id ? res : r));
    } else {
      setReservations([...reservations, res]);
    }
    setEditingReservation(undefined);
  };

  const deleteReservation = (id: string) => {
      setSaveState('pending'); // Immediate feedback
      setReservations(reservations.filter(r => r.id !== id));
  };

  // NEW: Payment Handlers
  const handleAddPayment = (payment: OwnerPayment) => {
      setSaveState('pending');
      setPayments(prev => [...prev, payment]);
      
      // Update reservations to mark them as paid
      setReservations(prev => prev.map(r => {
          if (payment.reservationIds.includes(r.id)) {
              return { ...r, paymentId: payment.id };
          }
          return r;
      }));
  };

  const handleDeletePayment = (paymentId: string) => {
      setSaveState('pending');
      setPayments(prev => prev.filter(p => p.id !== paymentId));
      
      // Unlink reservations (make them unpaid again)
      setReservations(prev => prev.map(r => {
          if (r.paymentId === paymentId) {
              const { paymentId, ...rest } = r; // Remove paymentId
              return rest as Reservation;
          }
          return r;
      }));
  };

  const openNewProperty = () => {
    setEditingProperty(undefined);
    setIsPropertyModalOpen(true);
  };

  const openEditProperty = (prop: Property) => {
    setEditingProperty(prop);
    setIsPropertyModalOpen(true);
  };

  const openNewReservation = () => {
    setEditingReservation(undefined);
    setIsReservationModalOpen(true);
  };

  const openEditReservation = (res: Reservation) => {
    setEditingReservation(res);
    setIsReservationModalOpen(true);
  };

  const toggleReservationExclusion = (id: string) => {
    if (isOwner) return;
    setExcludedReservationIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
  };

  const handleExportData = () => {
    const data = {
        properties,
        reservations,
        payments,
        timestamp: new Date().toISOString(),
        version: "1.1"
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gestor_pro_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const data = JSON.parse(content);
            if (data.properties && Array.isArray(data.properties)) setProperties(data.properties);
            if (data.reservations && Array.isArray(data.reservations)) setReservations(data.reservations);
            if (data.payments && Array.isArray(data.payments)) setPayments(data.payments);
            alert("Datos restaurados correctamente.");
        } catch (error) {
            alert("Error al leer el archivo.");
        }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // NEW: Excel Import Handler
  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
          // Process file using the new service
          const result = await processExcelFile(file, properties);
          
          if (result.errors.length > 0) {
              const confirmText = `Se encontraron algunos problemas:\n\n${result.errors.slice(0, 5).join('\n')}${result.errors.length > 5 ? '\n...' : ''}\n\n¿Deseas importar lo que sí pudimos leer?`;
              if (!window.confirm(confirmText)) {
                  event.target.value = '';
                  return;
              }
          }

          if (result.newProperties.length === 0 && result.newReservations.length === 0) {
              alert("No encontramos datos válidos para importar. Revisa los encabezados de tu Excel.");
              event.target.value = '';
              return;
          }

          // Merge Data
          setSaveState('pending');
          if (result.newProperties.length > 0) {
              setProperties(prev => [...prev, ...result.newProperties]);
          }
          if (result.newReservations.length > 0) {
              setReservations(prev => [...prev, ...result.newReservations]);
          }

          alert(`${result.summary} Importación exitosa.`);

      } catch (e: any) {
          alert(e.message || "Error desconocido al importar Excel.");
      }
      
      event.target.value = ''; // Reset input
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogin = () => {
      setAuthError('');
      if (loginStep === 'admin') {
          if (loginCode === '42699') {
              setCurrentUser({ role: 'admin' });
          } else {
              setAuthError('Código incorrecto');
          }
      } else if (loginStep === 'owner') {
          if (!selectedOwnerPropId) {
              setAuthError('Selecciona una propiedad');
              return;
          }
          const expectedCode = `00${selectedOwnerPropId}`;
          if (loginCode === expectedCode) {
              setCurrentUser({ role: 'owner', propertyId: selectedOwnerPropId });
          } else {
              setAuthError('Código de propiedad incorrecto');
          }
      }
  };

  const handleLogout = () => {
      setCurrentUser({ role: null });
      setLoginStep('selection');
      setLoginCode('');
      setSelectedOwnerPropId('');
      setAuthError('');
      setActiveTab('dashboard');
  };

  const handleAIAction = (action: AppAction) => {
    if (!isAdmin) return; 
    setSaveState('pending'); // Immediate feedback
    switch (action.type) {
        case 'ADD_PROPERTY': setProperties(prev => [...prev, action.payload]); break;
        case 'UPDATE_PROPERTY': setProperties(prev => prev.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p)); break;
        case 'DELETE_PROPERTY': setProperties(prev => prev.filter(p => p.id !== action.payload.id)); break;
        case 'ADD_RESERVATION': setReservations(prev => [...prev, action.payload]); break;
        case 'UPDATE_RESERVATION': setReservations(prev => prev.map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r)); break;
        case 'DELETE_RESERVATION': setReservations(prev => prev.filter(r => r.id !== action.payload.id)); break;
    }
  };

  const calculateNights = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  const formatCustomDate = (checkIn: string, checkOut: string) => {
    const parseLocal = (s: string) => new Date(s + 'T12:00:00');
    const inDate = parseLocal(checkIn);
    const outDate = parseLocal(checkOut);
    return `${monthNames[inDate.getMonth()]} - ${inDate.getDate()} / ${monthNames[outDate.getMonth()]} - ${outDate.getDate()} / ${outDate.getFullYear()}`;
  };

 const stats = useMemo(() => {
  let totalRevenue = 0;
  let myEarnings = 0;
  let ownerPayouts = 0;
  
  monthlyReservations.forEach(r => {
    const prop = visibleProperties.find(p => p.id === r.propertyId);
    if (prop) {
      const isMonthly = r.reservationType === ReservationType.Monthly;
      
      if (isMonthly) {
        // ✅ RESERVA MENSUAL
        const monthlyTotal = r.totalAmount || 0;
        const expensesAndOwnerPay = r.monthlyExpensesAndOwnerPay || 0;
        const myProfit = monthlyTotal - expensesAndOwnerPay;
        
        totalRevenue += monthlyTotal;
        myEarnings += myProfit;
        ownerPayouts += expensesAndOwnerPay;
      } else {
        // ✅ RESERVA ESTÁNDAR
        const copValue = getAirbnbCopValue(r);
        const commission = copValue * (prop.commissionRate / 100);
        
        totalRevenue += copValue;
        myEarnings += commission;
        ownerPayouts += (copValue - commission);
      }
    }
  });
  
  return { totalRevenue, myEarnings, ownerPayouts };
}, [visibleProperties, monthlyReservations, manualExchangeRate, marketExchangeRate]);


  const revenueByPropertyData = useMemo(() => {
      return visibleProperties.map(p => {
          const revenue = monthlyReservations
            .filter(r => r.propertyId === p.id)
            .reduce((sum, r) => sum + getAirbnbCopValue(r), 0);
          return { name: p.name, revenue, id: p.id };
      });
  }, [visibleProperties, monthlyReservations, manualExchangeRate, marketExchangeRate]);

  const platformData = useMemo(() => {
    const counts: Record<string, number> = {};
    monthlyReservations.forEach(r => counts[r.platform] = (counts[r.platform] || 0) + 1);
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [monthlyReservations]);

  // --- Render Sections ---

  if (!currentUser.role) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="bg-white max-w-md w-full rounded-3xl shadow-xl overflow-hidden border border-slate-100">
                  <div className="bg-primary-600 p-8 text-center">
                      <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 backdrop-blur-sm">
                          <Lock size={32} />
                      </div>
                      <h1 className="text-2xl font-bold text-white">Odihna Balance</h1>
                      <p className="text-primary-100 mt-2 text-sm">Plataforma de calculo de Odihna </p>
                  </div>
                  <div className="p-8">
                      {loginStep === 'selection' && (
                          <div className="space-y-4">
                              <button onClick={() => setLoginStep('admin')} className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-primary-500 hover:bg-primary-50 transition-all group">
                                  <div className="flex items-center gap-3"><Users size={20} className="text-slate-600"/><div><div className="font-semibold text-slate-800 text-left">Administrador</div></div></div>
                                  <ArrowRight size={18} className="text-slate-300 group-hover:text-primary-500" />
                              </button>
                              <button onClick={() => setLoginStep('owner')} className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50 transition-all group">
                                  <div className="flex items-center gap-3"><Building2 size={20} className="text-slate-600"/><div><div className="font-semibold text-slate-800 text-left">Soy Dueño</div></div></div>
                                  <ArrowRight size={18} className="text-slate-300 group-hover:text-purple-500" />
                              </button>
                          </div>
                      )}
                      {(loginStep === 'admin' || loginStep === 'owner') && (
                          <div className="space-y-6 animate-fade-in">
                              <button onClick={() => { setLoginStep('selection'); setAuthError(''); setLoginCode(''); }} className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 mb-2"> <ChevronLeft size={16} /> Volver </button>
                              <div className="text-center mb-6"><h2 className="text-xl font-bold text-slate-800">{loginStep === 'admin' ? 'Acceso Administrador' : 'Acceso Propietario'}</h2></div>
                              {loginStep === 'owner' && (
                                  <div>
                                      <label className="block text-sm font-medium text-slate-700 mb-1">Selecciona tu Propiedad</label>
                                      <select className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white" value={selectedOwnerPropId} onChange={(e) => setSelectedOwnerPropId(e.target.value)}>
                                          <option value="">-- Seleccionar --</option>
                                          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                      </select>
                                  </div>
                              )}
                              <div>
                                  <label className="block text-sm font-medium text-slate-700 mb-1">{loginStep === 'admin' ? 'Código de Seguridad' : 'Código de Propiedad'}</label>
                                  <input type="password" placeholder="Ingrese código..." className="w-full px-4 py-3 border border-slate-200 rounded-xl" value={loginCode} onChange={(e) => setLoginCode(e.target.value)}/>
                              </div>
                              {authError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2"><AlertTriangle size={16} />{authError}</div>}
                              <button onClick={handleLogin} className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors shadow-lg">Ingresar</button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  // --- Render Helpers (Consolidated) ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in pb-24 lg:pb-12">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="font-bold text-slate-700 flex items-center gap-2"><Calendar size={20} className="text-primary-500"/> Resumen Mensual</h2>
        <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">Filtrar mes:</span>
            <input type="month" value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="bg-white px-4 py-2 border border-slate-200 rounded-xl text-slate-700 font-medium outline-none focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"/>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><div className="flex items-center gap-4"><div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={24} /></div><div><p className="text-sm text-slate-500 font-medium">Ingresos - <span className="capitalize">{formatMonthYear(currentMonth)}</span></p><h3 className="text-2xl font-bold text-slate-800">{formatCOP(stats.totalRevenue)}</h3></div></div></div>
        {isAdmin && <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><div className="flex items-center gap-4"><div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign size={24} /></div><div><p className="text-sm text-slate-500 font-medium">Mis Ganancias - <span className="capitalize">{formatMonthYear(currentMonth)}</span></p><h3 className="text-2xl font-bold text-slate-800">{formatCOP(stats.myEarnings)}</h3></div></div></div>}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><div className="flex items-center gap-4"><div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Users size={24} /></div><div><p className="text-sm text-slate-500 font-medium">{isAdmin ? 'Pagos a Dueños' : 'Mi Pago Final'} - <span className="capitalize">{formatMonthYear(currentMonth)}</span></p><h3 className="text-2xl font-bold text-slate-800">{formatCOP(stats.ownerPayouts)}</h3></div></div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><h3 className="text-lg font-bold text-slate-800 mb-4">Ingresos ({formatMonthYear(currentMonth)})</h3><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><RechartsBarChart data={revenueByPropertyData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{fontSize: 10}} interval={0} /><YAxis tick={{fontSize: 12}} /><Tooltip formatter={(value: number) => formatCOP(value)} /><Bar dataKey="revenue" radius={[4, 4, 0, 0]}>{revenueByPropertyData.map((entry, index) => (<Cell key={`cell-${index}`} fill={getColorForId(entry.id)} />))}</Bar></RechartsBarChart></ResponsiveContainer></div></div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><h3 className="text-lg font-bold text-slate-800 mb-4">Plataformas ({formatMonthYear(currentMonth)})</h3><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><RechartsPieChart><Pie data={platformData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{platformData.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></RechartsPieChart></ResponsiveContainer></div></div>
      </div>
    </div>
  );
    {/* ✅ NUEVO: PANEL DE CONFIGURACIÓN DE TASA DE CAMBIO PARA AIRBNB */}
    {isAdmin && (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-2xl border-2 border-purple-200">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-purple-600 text-white rounded-lg">
            <DollarSign size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">
              Recálculo de Tasa Airbnb (Pago a Dueños)
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              Aplica una tasa diferente para calcular el pago final a dueños en reservas USD de Airbnb
            </p>
          </div>
        </div>

        {/* Toggle Principal */}
        <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-purple-200 mb-4">
          <input 
            type="checkbox" 
            id="useCustomRate"
            checked={useCustomRateForPayouts}
            onChange={(e) => setUseCustomRateForPayouts(e.target.checked)}
            className="w-5 h-5 text-purple-600 rounded focus:ring-2 focus:ring-purple-500"
          />
          <label htmlFor="useCustomRate" className="flex-1 cursor-pointer">
            <div className="font-semibold text-slate-800">
              Activar Recálculo de Tasa para Pagos
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Los pagos a dueños se calcularán con la tasa que elijas abajo
            </div>
          </label>
        </div>

        {/* Selector de Tasa */}
        {useCustomRateForPayouts && (
          <div className="space-y-3 animate-fade-in">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              ¿Qué tasa usar para el pago?
            </label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Opción Manual */}
              <button
                onClick={() => setPayoutRateSource('manual')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  payoutRateSource === 'manual'
                    ? 'border-purple-500 bg-purple-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-purple-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    payoutRateSource === 'manual' 
                      ? 'border-purple-600 bg-purple-600' 
                      : 'border-slate-300'
                  }`}>
                    {payoutRateSource === 'manual' && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="font-semibold text-slate-800">Tasa Manual</span>
                </div>
                <div className="text-2xl font-bold text-purple-600 mb-1">
                  ${manualExchangeRate.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500">
                  Por dólar (configurado por ti)
                </div>
              </button>

              {/* Opción TRM */}
              <button
                onClick={() => setPayoutRateSource('trm')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  payoutRateSource === 'trm'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-slate-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    payoutRateSource === 'trm' 
                      ? 'border-blue-600 bg-blue-600' 
                      : 'border-slate-300'
                  }`}>
                    {payoutRateSource === 'trm' && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                  <span className="font-semibold text-slate-800">TRM Oficial</span>
                </div>
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  ${marketExchangeRate.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500">
                  {rateSource}
                </div>
              </button>
            </div>

            {/* Info Box */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2 mt-4">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>Cómo funciona:</strong> Las reservas de Airbnb se registraron con la tasa del día. 
                Al activar esto, los <strong>pagos a dueños</strong> se recalcularán usando la tasa que elijas 
                ({payoutRateSource === 'manual' ? 'Manual' : 'TRM'}), reflejando la diferencia cambiaria real.
              </div>
            </div>
          </div>
        )}
      </div>
    )}

 const renderProperties = () => {
  const filteredProperties = visibleProperties.filter(p => 
    p.name.toLowerCase().includes(propertySearch.toLowerCase()) || 
    p.ownerName.toLowerCase().includes(propertySearch.toLowerCase())
  );
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-24 lg:mb-12">
      {/* Header Section */}
      <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800">
          {isOwner ? 'Mi Propiedad' : 'Mis Propiedades'}
        </h2>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" 
              value={propertySearch} 
              onChange={(e) => setPropertySearch(e.target.value)}
            />
          </div>
          
          {/* Action Buttons (Admin Only) */}
          {isAdmin && (
            <div className="flex gap-2">
              <button 
                onClick={() => setIsVoiceModalOpen(true)} 
                className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200"
              >
                <Mic size={16} />
                <span className="hidden sm:inline">Voz</span>
              </button>
              
              <button 
                onClick={openNewProperty} 
                className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Manual</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Table Section */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          {/* Table Headers */}
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Nombre</th>
              <th className="px-6 py-4">Dueño</th>
              {isAdmin && <th className="px-6 py-4">Código Acceso</th>}
              <th className="px-6 py-4">Ciudad</th>
              <th className="px-6 py-4">Comisión</th>
              {isAdmin && <th className="px-6 py-4 text-right">Acciones</th>}
            </tr>
          </thead>
          
          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {filteredProperties.map((prop) => (
              <tr key={prop.id} className="hover:bg-slate-50/50 transition-colors">
                {/* Property Name */}
                <td className="px-6 py-4 font-medium text-slate-800">
                  {prop.name}
                </td>
                
                {/* Owner Name */}
                <td className="px-6 py-4 text-slate-600">
                  {prop.ownerName}
                </td>
                
                {/* Access Code (Admin Only) */}
                {isAdmin && (
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => copyToClipboard(`00${prop.id}`)} 
                      className="flex items-center gap-2 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-mono text-slate-600 transition-colors group relative"
                    >
                      <span className="max-w-[100px] truncate">
                        00{prop.id}
                      </span>
                      {copiedId === `00${prop.id}` ? (
                        <Check size={12} className="text-emerald-500" />
                      ) : (
                        <Copy size={12} className="text-slate-400 group-hover:text-slate-600" />
                      )}
                    </button>
                  </td>
                )}
                
                {/* City */}
                <td className="px-6 py-4 text-slate-600">
                  <div className="flex items-center gap-1">
                    <MapPin size={14} className="text-slate-400" />
                    {prop.city}
                  </div>
                </td>
                
                {/* Commission Rate */}
                <td className="px-6 py-4">
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                    {prop.commissionRate}%
                  </span>
                </td>
                
                {/* Actions (Admin Only) */}
                {isAdmin && (
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => openEditProperty(prop)} 
                        className="p-1 text-slate-400 hover:text-primary-600"
                      >
                        <Pencil size={18} />
                      </button>
                      
                      <button 
                        onClick={() => deleteProperty(prop.id)} 
                        className="p-1 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


 const renderReservations = () => {
  const filteredReservations = visibleReservations.filter(res => {
    const prop = visibleProperties.find(p => p.id === res.propertyId);
    let match = res.guestName.toLowerCase().includes(reservationSearch.toLowerCase()) || 
                (prop?.name || '').toLowerCase().includes(reservationSearch.toLowerCase());
    if (dateFilterStart) match = match && res.checkInDate >= dateFilterStart;
    if (dateFilterEnd) match = match && res.checkInDate <= dateFilterEnd;
    return match;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-24 lg:mb-12">
      {/* Header Section */}
      <div className="p-6 border-b border-slate-100 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Reservas Recientes</h2>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <button 
                  onClick={() => setIsVoiceModalOpen(true)} 
                  className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 shadow-sm"
                >
                  <Mic size={16} /> 
                  <span className="hidden sm:inline">Voz</span>
                </button>
                <button 
                  onClick={openNewReservation} 
                  className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 shadow-sm"
                >
                  <Plus size={16} /> 
                  <span className="hidden sm:inline">Nueva</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm" 
              value={reservationSearch} 
              onChange={(e) => setReservationSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-400 font-medium uppercase">Desde:</span>
              <input 
                type="date" 
                className="text-sm focus:outline-none text-slate-600 bg-transparent" 
                value={dateFilterStart} 
                onChange={(e) => setDateFilterStart(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-400 font-medium uppercase">Hasta:</span>
              <input 
                type="date" 
                className="text-sm focus:outline-none text-slate-600 bg-transparent" 
                value={dateFilterEnd} 
                onChange={(e) => setDateFilterEnd(e.target.value)}
              />
            </div>
            {(reservationSearch || dateFilterStart || dateFilterEnd) && (
              <button 
                onClick={() => {
                  setReservationSearch('');
                  setDateFilterStart('');
                  setDateFilterEnd('');
                }} 
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Table Section */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          {/* ✅ HEADERS ACTUALIZADOS */}
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">#</th>
              <th className="px-6 py-4">Propiedad</th>
              <th className="px-6 py-4">Huésped</th>
              <th className="px-6 py-4">Plataforma</th>
              <th className="px-6 py-4">Fechas</th>
              <th className="px-6 py-4">Monto Original</th>
              <th className="px-6 py-4 text-right">Total (COP)</th>
              <th className="px-6 py-4 text-center">Estado</th>
              {isAdmin && <th className="px-6 py-4 text-right">Mi Ganancia</th>}
              {isAdmin && <th className="px-6 py-4 text-right">Pago Dueño</th>}
              {isAdmin && <th className="px-6 py-4 text-right">Acciones</th>}
            </tr>
          </thead>
          
          {/* ✅ TBODY COMPLETAMENTE ACTUALIZADO */}
          <tbody className="divide-y divide-slate-100">
            {filteredReservations.map((res, index) => { 
              const prop = visibleProperties.find(p => p.id === res.propertyId);
              if (!prop) return null;
              
              const isMonthly = res.reservationType === ReservationType.Monthly;
              const copValue = getAirbnbCopValue(res);
              const nights = calculateNights(res.checkInDate, res.checkOutDate);
              
              // ✅ Cálculo según tipo de reserva
              let myEarning = 0;
              let ownerPayout = 0;
              
              if (isMonthly) {
                const expensesAndOwnerPay = res.monthlyExpensesAndOwnerPay || 0;
                myEarning = res.totalAmount - expensesAndOwnerPay;
                ownerPayout = expensesAndOwnerPay;
              } else {
                const commission = copValue * (prop.commissionRate / 100);
                myEarning = commission;
                ownerPayout = copValue - commission;
              }
              
              return (
                <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* # */}
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">
                    #{index + 1}
                  </td>
                  
                  {/* Propiedad con Badge Mensual */}
                  <td className="px-6 py-4 font-medium text-slate-800">
                    <div className="flex flex-col gap-1">
                      <span>{prop?.name || 'Desconocida'}</span>
                      {isMonthly && (
                        <span className="inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-300">
                          📆 MENSUAL ({res.monthsCount} {res.monthsCount === 1 ? 'mes' : 'meses'})
                        </span>
                      )}
                    </div>
                  </td>
                  
                  {/* Huésped */}
                  <td className="px-6 py-4 text-slate-600">
                    {res.guestName}
                  </td>
                  
                  {/* Plataforma */}
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      res.platform === Platform.Airbnb 
                        ? 'bg-rose-100 text-rose-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {res.platform}
                    </span>
                  </td>
                  
                  {/* Fechas */}
                  <td className="px-6 py-4 text-slate-500 text-sm whitespace-nowrap">
                    <div className="space-y-1">
                      <div>{formatCustomDate(res.checkInDate, res.checkOutDate)}</div>
                      {!isMonthly && (
                        <div className="text-xs text-slate-400">
                          ({nights} {nights === 1 ? 'noche' : 'noches'})
                        </div>
                      )}
                    </div>
                  </td>
                  
                  {/* Monto Original */}
                  <td className="px-6 py-4 text-slate-600">
                    {res.platform === Platform.Airbnb && !isMonthly && res.usdAmount ? (
                      <div className="space-y-1">
                        <div className="font-bold text-emerald-600">
                          USD ${res.usdAmount.toFixed(2)}
                        </div>
                        {res.exchangeRate && (
                          <div className="text-[10px] text-slate-400">
                            @ {res.exchangeRate.toFixed(2)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {formatCOP(res.totalAmount)}
                        {isMonthly && (
                          <div className="text-[10px] text-purple-600 font-semibold">
                            Valor Mensual
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  
                  {/* Total COP */}
                  <td className="px-6 py-4 text-right font-bold text-slate-800">
                    {formatCOP(isMonthly ? res.totalAmount : copValue)}
                  </td>
                  
                  {/* Estado */}
                  <td className="px-6 py-4 text-center">
                    {res.paymentId ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                        <Check size={10} /> Pagado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase">
                        <AlertTriangle size={10} /> Pendiente
                      </span>
                    )}
                  </td>
                  
                  {/* ✅ MI GANANCIA (NUEVA COLUMNA - Solo Admin) */}
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="space-y-1">
                        <div className="font-bold text-emerald-600">
                          {formatCOP(myEarning)}
                        </div>
                        {!isMonthly && (
                          <div className="text-xs text-slate-500">
                            ({prop.commissionRate}% com.)
                          </div>
                        )}
                        {isMonthly && (
                          <div className="text-xs text-purple-600">
                            (Diferencia)
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                  
                  {/* ✅ PAGO DUEÑO (NUEVA COLUMNA - Solo Admin) */}
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="space-y-1">
                        <div className="font-semibold text-orange-600">
                          {formatCOP(ownerPayout)}
                        </div>
                        {isMonthly && (
                          <div className="text-[10px] text-slate-500">
                            (Gastos + Pago)
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                  
                  {/* Acciones (Admin) */}
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openEditReservation(res)} 
                          className="p-1 text-slate-400 hover:text-primary-600"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          onClick={() => deleteReservation(res.id)} 
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};


  const renderGeneralReports = () => {
    const ownerStats: Record<string, { revenue: number, payout: number, props: string[] }> = {};
    visibleProperties.forEach(p => { if (!ownerStats[p.ownerName]) ownerStats[p.ownerName] = { revenue: 0, payout: 0, props: [] }; ownerStats[p.ownerName].props.push(p.name); });
    
   monthlyReservations.forEach(r => { 
  const prop = visibleProperties.find(p => p.id === r.propertyId); 
  if (prop && ownerStats[prop.ownerName]) {
    const isMonthly = r.reservationType === ReservationType.Monthly;
    
    if (isMonthly) {
      const monthlyTotal = r.totalAmount || 0;
      const expensesAndOwnerPay = r.monthlyExpensesAndOwnerPay || 0;
      
      ownerStats[prop.ownerName].revenue += monthlyTotal;
      ownerStats[prop.ownerName].payout += expensesAndOwnerPay;
    } else {
      const copValue = getAirbnbCopValue(r);
      const commission = copValue * (prop.commissionRate / 100); 
      
      ownerStats[prop.ownerName].revenue += copValue; 
      ownerStats[prop.ownerName].payout += (copValue - commission); 
    }
  } 
});


    return (
        <div className="space-y-6 pb-24 lg:pb-12">
             <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center gap-3 text-blue-700 text-sm">
                <AlertTriangle size={18} />
                <span>Vista Mensual: Mostrando reservas que <strong>inician</strong> en {formatMonthYear(currentMonth)}.</span>
                <input type="month" value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="ml-auto px-4 py-1.5 bg-white border border-blue-200 rounded-lg text-sm text-slate-700 font-medium"/>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{Object.entries(ownerStats).map(([owner, data]) => (<div key={owner} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between"><div><div className="flex justify-between items-start mb-4"><div><h3 className="font-bold text-lg text-slate-800">{owner}</h3><div className="mt-1 space-y-1">{data.props.map((propName) => (<p key={propName} className="text-xs text-slate-500 flex items-center gap-1.5"><Building2 size={12}/>{propName}</p>))}</div></div></div><div className="space-y-2 mb-6"><div className="flex justify-between text-sm"><span className="text-slate-500">Total</span><span className="font-medium">{formatCOP(data.revenue)}</span></div>{isAdmin && (<div className="flex justify-between text-sm"><span className="text-slate-500">Comisiones</span><span className="font-medium text-red-500">-{formatCOP(data.revenue - data.payout)}</span></div>)}</div></div><div className="pt-4 border-t border-slate-100"><div className="flex justify-between items-end"><span className="text-slate-600 font-medium">Pago Final</span><span className="text-2xl font-bold text-primary-600">{formatCOP(data.payout)}</span></div></div></div>))}</div>
        </div>
    );
  };

 const renderCustomReports = () => {
  const rangeStart = customStartDate;
  const rangeEnd = customEndDate;

  const relevantReservations = visibleReservations.filter(r => {
    if (!rangeStart || !rangeEnd) return false;
    return r.checkInDate <= rangeEnd && r.checkOutDate >= rangeStart;
  });

  const ownerStats: Record<string, { 
    revenue: number, 
    payout: number, 
    props: string[], 
    reservations: { 
      res: Reservation, 
      isPartial: boolean, 
      isExcluded: boolean, 
      commission: number, 
      calculatedCop: number,
      recalcData?: ReturnType<typeof recalculateAirbnbPayout>
    }[] 
  }> = {};

  visibleProperties.forEach(p => { 
    if (!ownerStats[p.ownerName]) ownerStats[p.ownerName] = { revenue: 0, payout: 0, props: [], reservations: [] }; 
    if (!ownerStats[p.ownerName].props.includes(p.name)) ownerStats[p.ownerName].props.push(p.name); 
  });

  relevantReservations.forEach(r => {
    const prop = visibleProperties.find(p => p.id === r.propertyId);
    if (prop && ownerStats[prop.ownerName]) {
      const isPartial = r.checkInDate < rangeStart || r.checkOutDate > rangeEnd;
      const isExcluded = excludedReservationIds.has(r.id);
      const isMonthly = r.reservationType === ReservationType.Monthly;

      let copValue = 0;
      let commission = 0;
      let recalcData = null;

      if (isMonthly) {
        copValue = r.totalAmount || 0;
        const expensesAndOwnerPay = r.monthlyExpensesAndOwnerPay || 0;
        commission = copValue - expensesAndOwnerPay;
      } else {
        copValue = getAirbnbCopValue(r);
        commission = copValue * (prop.commissionRate / 100);
        
        if (useCustomRateForPayouts && r.platform === Platform.Airbnb && r.usdAmount) {
          recalcData = recalculateAirbnbPayout(r, prop);
        }
      }

      ownerStats[prop.ownerName].reservations.push({
        res: r,
        isPartial,
        isExcluded,
        commission,
        calculatedCop: copValue,
        recalcData
      });

      if (!isExcluded) {
        if (recalcData && useCustomRateForPayouts) {
          ownerStats[prop.ownerName].revenue += recalcData.originalCOP;
          ownerStats[prop.ownerName].payout += recalcData.ownerPayoutRecalculated;
        } else {
          ownerStats[prop.ownerName].revenue += copValue;
          ownerStats[prop.ownerName].payout += (copValue - commission);
        }
      }
    }
  });

  // Calcular liquidación con tasa personalizada
  const liquidation = calculateLiquidation(ownerStats);

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      {/* Panel de Filtros de Fecha */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Filter size={20} className="text-primary-500" /> Filtros de Fecha
        </h3>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Fecha Inicio</label>
            <input 
              type="date" 
              value={customStartDate} 
              onChange={(e) => setCustomStartDate(e.target.value)} 
              className="bg-white w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-700 shadow-sm" 
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-slate-500 mb-1 uppercase">Fecha Fin</label>
            <input 
              type="date" 
              value={customEndDate} 
              onChange={(e) => setCustomEndDate(e.target.value)} 
              className="bg-white w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-slate-700 shadow-sm" 
            />
          </div>
          <div className="w-full sm:w-auto pb-1 text-xs text-slate-400">
            * Incluye reservas que se crucen con estas fechas.
          </div>
        </div>
      </div>

      {/* Panel de Liquidación con Tasa Personalizada */}
      {isAdmin && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-2xl border-2 border-blue-300 shadow-lg">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
              <DollarSign size={24} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                💰 Liquidación Final con Tasa Personalizada
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Calcula el pago final a dueños usando una tasa de cambio diferente (solo afecta reservas Airbnb en USD)
              </p>
            </div>
          </div>

          {/* Toggle Principal */}
          <div className="bg-white rounded-xl p-4 shadow-sm border-2 border-blue-200 mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={useLiquidationRate}
                onChange={(e) => setUseLiquidationRate(e.target.checked)}
                className="w-6 h-6 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="font-bold text-slate-800 text-base">
                  Activar Cálculo de Liquidación
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Los valores originales no se modifican. Solo se recalcula el pago final.
                </div>
              </div>
            </label>
          </div>

          {/* Selector de Tasa */}
          {useLiquidationRate && (
            <div className="space-y-3 animate-fade-in">
              <label className="block text-sm font-bold text-slate-700 mb-3">
                📊 Selecciona la tasa para liquidación final:
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Opción Manual */}
                <button
                  onClick={() => setLiquidationRateType('manual')}
                  className={`group p-5 rounded-xl border-2 transition-all text-left ${
                    liquidationRateType === 'manual'
                      ? 'border-purple-500 bg-purple-50 shadow-lg scale-105'
                      : 'border-slate-200 bg-white hover:border-purple-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      liquidationRateType === 'manual' 
                        ? 'border-purple-600 bg-purple-600 scale-110' 
                        : 'border-slate-300 group-hover:border-purple-400'
                    }`}>
                      {liquidationRateType === 'manual' && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                      )}
                    </div>
                    <span className="font-bold text-slate-800 text-lg">🎯 Tasa Manual</span>
                  </div>
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    ${manualExchangeRate.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    COP por cada USD (configurado por ti)
                  </div>
                </button>

                {/* Opción TRM */}
                <button
                  onClick={() => setLiquidationRateType('trm')}
                  className={`group p-5 rounded-xl border-2 transition-all text-left ${
                    liquidationRateType === 'trm'
                      ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      liquidationRateType === 'trm' 
                        ? 'border-blue-600 bg-blue-600 scale-110' 
                        : 'border-slate-300 group-hover:border-blue-400'
                    }`}>
                      {liquidationRateType === 'trm' && (
                        <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                      )}
                    </div>
                    <span className="font-bold text-slate-800 text-lg">🏛️ TRM Oficial</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    ${marketExchangeRate.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {rateSource}
                  </div>
                </button>
              </div>

              {/* Info Box */}
              <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <strong className="font-bold">💡 Cómo funciona:</strong>
                    <ul className="mt-2 space-y-1 ml-4 list-disc">
                      <li>Las reservas de Airbnb se registraron con su tasa original</li>
                      <li>Al activar esto, se <strong>recalcula el pago final</strong> usando la tasa: <strong>{liquidationRateType === 'manual' ? 'Manual' : 'TRM Oficial'}</strong></li>
                      <li>Verás la <strong>diferencia</strong> (ganancia o pérdida) por el cambio de tasa</li>
                      <li className="text-emerald-700 font-semibold">✅ Los valores originales NO se modifican</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Contenido Principal */}
      {(!customStartDate || !customEndDate) ? (
        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <CalendarRange size={48} className="mx-auto mb-2 opacity-20" />
          <p>Selecciona un rango de fechas para generar el reporte.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {Object.entries(ownerStats).map(([owner, data]) => {
            if (data.reservations.length === 0) return null;
            return (
              <div key={owner} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-lg text-slate-800">{owner}</h3>
                    <div className="flex gap-2 text-xs text-slate-500 mt-1">
                      {data.props.map(p => (
                        <span key={p} className="bg-white border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1">
                          <Building2 size={10}/> {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">A Pagar (COP)</p>
                    <p className="text-2xl font-bold text-primary-600">{formatCOP(data.payout)}</p>
                  </div>
                </div>

                {/* Panel de Liquidación por Dueño */}
                {useLiquidationRate && liquidation && liquidation[owner] && liquidation[owner].airbnbCount > 0 && (
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 border-b-2 border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign size={18} className="text-blue-600" />
                      <span className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                        💰 Liquidación Final con Tasa {liquidationRateType === 'manual' ? 'Manual' : 'TRM'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white p-3 rounded-lg border border-blue-200">
                        <div className="text-xs text-slate-600 mb-1">📋 Reservas Airbnb USD</div>
                        <div className="text-lg font-bold text-blue-600">
                          {liquidation[owner].airbnbCount}
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-blue-200">
                        <div className="text-xs text-slate-600 mb-1">💵 Pago con nueva tasa</div>
                        <div className="text-lg font-bold text-blue-600">
                          {formatCOP(liquidation[owner].liquidationPayout)}
                        </div>
                      </div>

                      <div className={`p-3 rounded-lg border-2 ${
                        liquidation[owner].difference > 0 
                          ? 'bg-green-100 border-green-300' 
                          : liquidation[owner].difference < 0
                          ? 'bg-red-100 border-red-300'
                          : 'bg-gray-100 border-gray-200'
                      }`}>
                        <div className="text-xs font-bold mb-1">
                          {liquidation[owner].difference > 0 ? '📈 Ganancia' : liquidation[owner].difference < 0 ? '📉 Pérdida' : '➖ Sin cambio'}
                        </div>
                        <div className={`text-lg font-bold ${
                          liquidation[owner].difference > 0 ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {liquidation[owner].difference > 0 ? '+' : ''}{formatCOP(Math.abs(liquidation[owner].difference))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tabla de Reservas */}
                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white text-slate-500 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 font-medium">Huesped / Plat.</th>
                        <th className="px-4 py-3 font-medium">Fechas</th>
                        <th className="px-4 py-3 font-medium text-right">Monto Original</th>
                        {isAdmin && useLiquidationRate && (
                          <th className="px-4 py-3 font-medium text-right bg-blue-50 text-blue-700 border-l-2 border-blue-200">
                            <div className="flex items-center justify-end gap-1">
                              <DollarSign size={14} />
                              <span>Monto Recalculado</span>
                            </div>
                          </th>
                        )}
                        {isAdmin && <th className="px-4 py-3 font-medium text-right text-red-400">Comisión</th>}
                        <th className="px-4 py-3 font-medium text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.reservations.map((item, idx) => {
                        // Calcular valor recalculado para esta fila
                        const recalculatedCOP = item.res.platform === Platform.Airbnb && item.res.usdAmount
                          ? item.res.usdAmount * (liquidationRateType === 'trm' ? marketExchangeRate : manualExchangeRate)
                          : null;
                        const difference = recalculatedCOP ? recalculatedCOP - item.calculatedCop : 0;

                        return (
                          <tr key={item.res.id} className={`${item.isExcluded ? 'bg-slate-50 opacity-60' : 'bg-white'} ${item.isPartial && !item.isExcluded ? 'bg-amber-50/50' : ''}`}>
                            {/* Columna Huésped */}
                            <td className="px-4 py-3 font-medium text-slate-700">
                              <div className="flex flex-col">
                                <span>{item.res.guestName}</span>
                                <span className={`text-[10px] w-fit px-1 rounded font-bold uppercase ${item.res.platform === Platform.Airbnb ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {item.res.platform}
                                </span>
                              </div>
                              {item.isPartial && (
                                <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                  <AlertTriangle size={10} className="mr-1"/> Conflicto de fechas
                                </span>
                              )}
                            </td>

                            {/* Columna Fechas */}
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {formatCustomDate(item.res.checkInDate, item.res.checkOutDate)}
                            </td>

                            {/* Columna Monto ORIGINAL */}
                            <td className={`px-4 py-3 text-right ${item.isExcluded ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                              <div className="flex flex-col">
                                <span className="font-bold">{formatCOP(item.calculatedCop)}</span>
                                
                                {/* Detalles Airbnb */}
                                {item.res.platform === Platform.Airbnb && item.res.usdAmount && (
                                  <div className="text-[10px] space-y-0.5 mt-1">
                                    {item.res.enteredAs === 'COP' ? (
                                      <>
                                        <div className="text-blue-600 font-bold">💵 Ingresado: {formatCOP(item.res.totalAmount)}</div>
                                        <div className="text-emerald-600">→ USD ${item.res.usdAmount?.toFixed(2)} @ {item.res.exchangeRate}</div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="text-emerald-600 font-bold">💵 Ingresado: USD ${item.res.usdAmount}</div>
                                        <div className="text-blue-600">→ Tasa: {item.res.exchangeRate} COP/USD</div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* NUEVA COLUMNA: Monto Recalculado */}
                            {isAdmin && useLiquidationRate && (
                              <td className="px-4 py-3 text-right bg-gradient-to-br from-blue-50/50 to-purple-50/50 border-l-2 border-blue-200">
                                {recalculatedCOP ? (
                                  <div className="flex flex-col">
                                    <span className="font-bold text-blue-700">
                                      {formatCOP(recalculatedCOP)}
                                    </span>
                                    
                                    <div className="text-[10px] space-y-0.5 mt-1">
                                      <div className="text-blue-600 font-bold">
                                        💱 {item.res.usdAmount?.toFixed(2)} USD
                                      </div>
                                      <div className="text-purple-600">
                                        @ {(liquidationRateType === 'trm' ? marketExchangeRate : manualExchangeRate).toFixed(2)}
                                      </div>
                                      
                                      {difference !== 0 && (
                                        <div className={`font-semibold flex items-center gap-1 ${difference > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          <span>{difference > 0 ? '📈' : '📉'}</span>
                                          <span>{difference > 0 ? '+' : ''}{formatCOP(Math.abs(difference))}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                              </td>
                            )}

                            {/* Columna Comisión */}
                            {isAdmin && (
                              <td className={`px-4 py-3 text-right font-mono text-xs ${item.isExcluded ? 'line-through text-slate-300' : 'text-red-500'}`}>
                                -{formatCOP(item.commission)}
                              </td>
                            )}

                            {/* Columna Estado */}
                            <td className="px-4 py-3 text-center">
                              {item.isPartial ? (
                                <button 
                                  onClick={() => toggleReservationExclusion(item.res.id)}
                                  className={`flex items-center justify-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all ${
                                    item.isExcluded 
                                      ? 'bg-slate-200 text-slate-500 hover:bg-slate-300' 
                                      : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                  }`}
                                >
                                  {item.isExcluded ? <Square size={14} /> : <CheckSquare size={14} />}
                                  {item.isExcluded ? 'Excluido' : 'Incluido'}
                                </button>
                              ) : (
                                <span className="text-xs text-emerald-600 font-medium flex justify-center gap-1">
                                  <Check size={14}/> Auto
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


  
  const renderReports = () => {
    return (
        <div className="space-y-6 pb-24 lg:pb-12 animate-fade-in">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Reportes y Estadísticas</h2>
                    <p className="text-slate-500 text-sm">Analiza el rendimiento de tus propiedades.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setReportSubTab('general')} 
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            reportSubTab === 'general' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        General
                    </button>
                    <button 
                        onClick={() => setReportSubTab('custom')} 
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            reportSubTab === 'custom' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Personalizado
                    </button>
                </div>
             </div>

            {/* USD Management Card - RESTORED & ADAPTED FOR MOBILE */}
            {isAdmin && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-6 mb-6">
                    <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-widest mb-4 flex items-center gap-2"><Globe size={16}/> Gestión de Divisas (Airbnb)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                        {/* Manual Rate Input */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Tasa de Pago Airbnb (USD a COP)</label>
                            <div className="relative">
                                <DollarSign size={16} className="absolute left-3 top-3 text-indigo-500"/>
                                <input
                                    type="number"
                                    value={manualExchangeRate}
                                    onChange={(e) => setManualExchangeRate(Number(e.target.value))}
                                    className="w-full pl-10 pr-4 py-2 bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
                                    placeholder="Ej. 3900"
                                />
                            </div>
                        </div>
                        {/* Market Rate Input/Fetch */}
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-500 uppercase">Tasa de Mercado (Oficial/Manual)</label>
                                <button onClick={fetchMarketRate} className="p-1 hover:bg-slate-200 rounded-full transition-colors" title="Refrescar TRM">
                                    <RefreshCcw size={12} className={isRateLoading ? "animate-spin text-indigo-600" : "text-slate-400"} />
                                </button>
                            </div>
                            <div className="relative">
                                <Globe size={16} className="absolute left-3 top-3 text-slate-400"/>
                                <input
                                    type="number"
                                    value={marketExchangeRate}
                                    onChange={(e) => setMarketExchangeRate(Number(e.target.value))}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-700"
                                />
                                {lastRateUpdate && <span className="absolute right-2 top-2 text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">{lastRateUpdate}</span>}
                            </div>
                            <div className="text-[10px] text-slate-400 text-right pr-1">
                                Fuente: {rateSource}
                            </div>
                        </div>
                        {/* Effective Rate Display */}
                        <div className="p-3 bg-white/60 border border-indigo-100 rounded-xl flex items-center gap-3">
                            <div className="p-2 bg-indigo-600 text-white rounded-lg"><ArrowDownUp size={18}/></div>
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Tasa Aplicada (Beneficio)</p>
                                <p className="text-lg font-black text-indigo-700">{formatCOP(getAirbnbEffectiveRate())}</p>
                            </div>
                        </div>
                    </div>
                    <p className="mt-4 text-xs text-indigo-600/70 italic flex items-center gap-1">
                        <AlertTriangle size={14}/> Lógica: Se utilizará el <strong>mínimo</strong> entre la tasa de pago y la de mercado para proteger tus márgenes.
                    </p>
                </div>
            )}

             {reportSubTab === 'general' ? renderGeneralReports() : renderCustomReports()}
        </div>
    );
  };

  const renderSettings = () => {
    return (
        <div className="space-y-6 pb-24 lg:pb-12 animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Configuración del Sistema</h2>
                    <p className="text-slate-500 text-sm">Gestiona tus datos y copias de seguridad.</p>
                </div>
             </div>

             <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6 relative overflow-hidden">
                <div className={`absolute top-0 right-0 p-4 ${cloudConfig.enabled ? 'text-emerald-500' : 'text-slate-300'}`}>
                    {cloudConfig.enabled ? <Wifi size={64} className="opacity-20" /> : <WifiOff size={64} className="opacity-20" />}
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <div className={`p-2 rounded-lg ${cloudConfig.enabled ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                        <Cloud size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">Sincronización en la Nube</h3>
                        <div className="flex items-center gap-2 text-sm mt-1">
                            <span className={`w-2 h-2 rounded-full ${cloudConfig.enabled ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                            <span className="text-slate-500">
                                Estado: {cloudConfig.enabled ? 'Auto-Sync Activo' : 'Sin conexión'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Última Sincronización</span>
                                {cloudStatus.isLoading && <RefreshCw size={14} className="animate-spin text-indigo-600"/>}
                            </div>
                            <p className="text-slate-800 font-mono text-sm">
                                {cloudStatus.lastSynced || 'Nunca'}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => handleCloudSync('upload')} disabled={cloudStatus.isLoading} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-200">
                                <Upload size={18} />
                                {cloudStatus.isLoading ? 'Subiendo...' : 'Sincronizar Manual'}
                            </button>
                            <button onClick={() => handleCloudSync('download')} disabled={cloudStatus.isLoading} className="flex-1 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                                <Download size={18} />
                                {cloudStatus.isLoading ? 'Bajando...' : 'Descargar'}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-4 border-l border-slate-100 pl-0 lg:pl-8">
                         <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                <KeyRound size={16} /> Credenciales (JSONBin.io)
                            </h4>
                            <label className="relative inline-flex items-center cursor-pointer group">
                                <input type="checkbox" checked={isEditingCloudConfig} onChange={(e) => setIsEditingCloudConfig(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                <div className="ml-2 text-slate-400">{isEditingCloudConfig ? <Unlock size={16}/> : <Lock size={16}/>}</div>
                            </label>
                        </div>
                        <div className={`space-y-3 transition-all ${isEditingCloudConfig ? 'opacity-100' : 'opacity-75'}`}>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">API Key (X-Master-Key)</label>
                                <div className="relative">
                                    <input type="password" disabled={!isEditingCloudConfig} value={cloudConfig.apiKey} onChange={(e) => setCloudConfig(prev => ({...prev, apiKey: e.target.value}))} className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${isEditingCloudConfig ? 'bg-white border-slate-300' : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'}`} />
                                    {!isEditingCloudConfig && <Lock size={12} className="absolute right-3 top-3 text-slate-400" />}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">Bin ID</label>
                                <div className="relative">
                                    <input type="text" disabled={!isEditingCloudConfig} value={cloudConfig.binId} onChange={(e) => setCloudConfig(prev => ({...prev, binId: e.target.value}))} className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${isEditingCloudConfig ? 'bg-white border-slate-300' : 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed'}`} />
                                    {!isEditingCloudConfig && <Lock size={12} className="absolute right-3 top-3 text-slate-400" />}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* NEW: Excel Import Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><FileSpreadsheet size={24} /></div><h3 className="font-bold text-slate-800">Importación Masiva (Excel)</h3></div>
                    <div className="space-y-3">
                         <p className="text-xs text-slate-500 leading-relaxed">
                            Sube un archivo .xlsx para agregar propiedades o reservas rápidamente. El sistema detectará las columnas automáticamente (Ej: "Nombre", "Dueño" o "Huesped", "Entrada").
                         </p>
                        <div className="relative">
                            <input type="file" ref={excelInputRef} onChange={handleImportExcel} accept=".xlsx, .xls, .csv" className="hidden" />
                            <button onClick={() => excelInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"><Upload size={18} />Cargar Excel / CSV</button>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><FileJson size={24} /></div><h3 className="font-bold text-slate-800">Respaldo Local</h3></div>
                    <div className="space-y-3">
                        <button onClick={handleExportData} className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-3 rounded-xl font-medium hover:bg-slate-900 transition-colors"><Save size={18} />Guardar Archivo</button>
                        <div className="relative">
                            <input type="file" ref={fileInputRef} onChange={handleImportData} accept=".json" className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-medium hover:bg-slate-50 transition-colors"><Upload size={18} />Cargar Archivo</button>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-red-500 md:col-span-2">
                    <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-red-50 text-red-600 rounded-lg"><Trash2 size={24} /></div><h3 className="font-bold text-slate-800">Zona de Peligro</h3></div>
                    <button onClick={() => { if (window.confirm("¿ESTÁS SEGURO?")) { setProperties([]); setReservations([]); localStorage.clear(); alert("Sistema reiniciado."); } }} className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 py-3 rounded-xl font-medium hover:bg-red-100 transition-colors"><AlertTriangle size={18} />Reiniciar de Fábrica</button>
                </div>
             </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-slate-50 overflow-hidden">
      {/* SIDEBAR / BOTTOM NAV */}
      <div className="order-2 lg:order-1 flex-shrink-0 z-20">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} toggleChat={() => setIsChatOpen(!isChatOpen)} isAdmin={isAdmin} />
      </div>

      {/* MAIN CONTENT */}
      <div className="order-1 lg:order-2 flex flex-col flex-1 h-full relative overflow-hidden">
        <div className="flex flex-col h-full">
            {/* Header Sticky */}
            <header className="flex justify-between items-center px-4 py-4 lg:px-8 lg:py-6 bg-white border-b border-slate-100 z-10 flex-shrink-0">
                <div className="flex-1">
                    <h1 className="text-xl lg:text-2xl font-bold text-slate-800 truncate">
                        {activeTab === 'dashboard' && 'Panel de Control'}
                        {activeTab === 'properties' && 'Mis Propiedades'}
                        {activeTab === 'reservations' && 'Libro de Reservas'}
                        {activeTab === 'reports' && 'Reportes'}
                        {activeTab === 'settings' && 'Configuración'}
                        {activeTab === 'payments' && 'Gestión de Pagos'}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        {isAdmin && <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Admin</span>}
                        {isOwner && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">Dueño</span>}
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {isAdmin && (
                        <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-500 ${
                            saveState === 'saved' ? 'bg-emerald-100 text-emerald-700' : 
                            saveState === 'saving' || saveState === 'pending' ? 'bg-amber-100 text-amber-700' :
                            saveState === 'error' ? 'bg-rose-100 text-rose-700' :
                            'opacity-0' 
                        }`}>
                            {saveState === 'saved' && <><Check size={14}/> Guardado</>}
                            {(saveState === 'saving' || saveState === 'pending') && <><RefreshCw size={14} className="animate-spin"/> Guardando...</>}
                            {saveState === 'error' && <><AlertTriangle size={14}/> Error</>}
                        </div>
                    )}
                    {isAdmin && (<button onClick={() => setIsVoiceModalOpen(true)} className="md:hidden p-3 bg-primary-600 text-white rounded-full shadow-lg active:scale-95 transition-transform"><Mic size={24} /></button>)}
                    <button onClick={handleLogout} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg lg:hidden"><LogOut size={20}/></button>
                </div>
            </header>

            {/* Scrollable Content Area */}
            <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'properties' && renderProperties()}
                {activeTab === 'reservations' && renderReservations()}
                {activeTab === 'reports' && renderReports()}
                {activeTab === 'settings' && renderSettings()}
                {activeTab === 'payments' && <PaymentsView properties={properties} reservations={reservations} payments={payments} onAddPayment={handleAddPayment} onDeletePayment={handleDeletePayment} getAirbnbCopValue={getAirbnbCopValue} />}
            </main>
        </div>
      </div>

      {isAdmin && <ChatBot isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} properties={properties} reservations={reservations} onAction={handleAIAction} />}
      {isAdmin && <VoiceCommandModal isOpen={isVoiceModalOpen} onClose={() => setIsVoiceModalOpen(false)} properties={properties} onAddProperty={handleSaveProperty} onAddReservation={handleSaveReservation} />}
      {isAdmin && <PropertyModal isOpen={isPropertyModalOpen} onClose={() => setIsPropertyModalOpen(false)} onSave={handleSaveProperty} propertyToEdit={editingProperty} />}
      {isAdmin && <ReservationModal isOpen={isReservationModalOpen} onClose={() => setIsReservationModalOpen(false)} onSave={handleSaveReservation} properties={properties} reservationToEdit={editingReservation} />}
    </div>
  );
}

export default App;
