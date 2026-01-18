import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, DollarSign, User, Globe, ArrowDownUp, TrendingUp } from 'lucide-react';
import { Reservation, Property, Platform } from '../types';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reservation: Reservation) => void;
  properties: Property[];
  reservationToEdit?: Reservation;
}

const safeId = () => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {}
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

const ReservationModal: React.FC<ReservationModalProps> = ({ 
  isOpen, onClose, onSave, properties, reservationToEdit 
}) => {
  const [formData, setFormData] = useState<Partial<Reservation>>({
    propertyId: '',
    guestName: '',
    totalAmount: 0,
    usdAmount: 0,
    platform: Platform.Direct,
    checkInDate: '',
    checkOutDate: '',
    exchangeRate: 4200, // Tasa por defecto
    enteredAs: 'USD' // Por defecto USD para Airbnb
  });

  // Estado para controlar qué campo está editando el usuario
  const [activeInput, setActiveInput] = useState<'COP' | 'USD'>('USD');

  useEffect(() => {
    if (reservationToEdit) {
      setFormData(reservationToEdit);
      // Si está editando, detectar qué ingresó originalmente
      if (reservationToEdit.enteredAs) {
        setActiveInput(reservationToEdit.enteredAs);
      }
    } else {
      setFormData({
        propertyId: properties[0]?.id || '',
        guestName: '',
        totalAmount: 0,
        usdAmount: 0,
        platform: Platform.Direct,
        checkInDate: new Date().toISOString().split('T')[0],
        checkOutDate: new Date().toISOString().split('T')[0],
        exchangeRate: 4200,
        enteredAs: 'USD'
      });
      setActiveInput('USD');
    }
  }, [reservationToEdit, isOpen, properties]);

  // Calcular automáticamente el otro valor cuando cambia uno
  useEffect(() => {
    if (formData.platform !== Platform.Airbnb) return;
    if (!formData.exchangeRate || formData.exchangeRate <= 0) return;

    if (activeInput === 'USD' && formData.usdAmount !== undefined) {
      // Usuario ingresó USD, calcular COP
      const calculatedCOP = formData.usdAmount * formData.exchangeRate;
      setFormData(prev => ({ ...prev, totalAmount: Math.round(calculatedCOP) }));
    } else if (activeInput === 'COP' && formData.totalAmount !== undefined) {
      // Usuario ingresó COP, calcular USD
      const calculatedUSD = formData.totalAmount / formData.exchangeRate;
      setFormData(prev => ({ ...prev, usdAmount: parseFloat(calculatedUSD.toFixed(2)) }));
    }
  }, [formData.usdAmount, formData.totalAmount, formData.exchangeRate, activeInput, formData.platform]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propertyId || !formData.guestName) return;

    // Validación para Airbnb
    if (formData.platform === Platform.Airbnb) {
      if (!formData.exchangeRate || formData.exchangeRate <= 0) {
        alert('Por favor ingresa una tasa de cambio válida para Airbnb');
        return;
      }
      if (!formData.usdAmount || formData.usdAmount <= 0) {
        alert('Por favor ingresa un monto válido');
        return;
      }
    }

    const reservationData: Reservation = {
      id: reservationToEdit?.id || safeId(),
      propertyId: formData.propertyId,
      guestName: formData.guestName,
      totalAmount: Number(formData.totalAmount),
      platform: formData.platform as Platform,
      checkInDate: formData.checkInDate || '',
      checkOutDate: formData.checkOutDate || ''
    };

    // Solo agregar campos de Airbnb si la plataforma es Airbnb
    if (formData.platform === Platform.Airbnb) {
      reservationData.usdAmount = Number(formData.usdAmount);
      reservationData.exchangeRate = Number(formData.exchangeRate);
      reservationData.enteredAs = activeInput;
    }

    onSave(reservationData);
    onClose();
  };

  if (!isOpen) return null;

  const isAirbnb = formData.platform === Platform.Airbnb;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">
            {reservationToEdit ? 'Editar Reserva' : 'Nueva Reserva'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Propiedad</label>
            <select
              required
              className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.propertyId}
              onChange={e => setFormData({ ...formData, propertyId: e.target.value })}
            >
              <option value="" disabled>Seleccionar Propiedad</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.commissionRate}%)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Huésped</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={18} />
              <input
                type="text"
                required
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.guestName}
                onChange={e => setFormData({ ...formData, guestName: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Plataforma</label>
            <div className="relative">
              <Globe className="absolute left-3 top-3 text-slate-400" size={18} />
              <select
                className="w-full pl-10 pr-2 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none font-semibold"
                value={formData.platform}
                onChange={e => {
                  const newPlatform = e.target.value as Platform;
                  setFormData({ 
                    ...formData, 
                    platform: newPlatform,
                    // Reset Airbnb-specific fields if changing away from Airbnb
                    exchangeRate: newPlatform === Platform.Airbnb ? 4200 : undefined,
                    enteredAs: newPlatform === Platform.Airbnb ? 'USD' : undefined
                  });
                }}
              >
                {Object.values(Platform).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* ========== AIRBNB: SECCIÓN ESPECIAL ========== */}
          {isAirbnb && (
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 p-4 rounded-xl border-2 border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-2">
                <TrendingUp size={16} />
                Configuración Airbnb
              </div>

              {/* Selector de Moneda de Ingreso */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">¿En qué moneda ingresas el monto?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveInput('USD')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      activeInput === 'USD'
                        ? 'bg-emerald-500 text-white shadow-lg'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    💵 USD (Dólares)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveInput('COP')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                      activeInput === 'COP'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    💰 COP (Pesos)
                  </button>
                </div>
              </div>

              {/* Tasa de Cambio */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tasa de Cambio (COP por cada USD)
                </label>
                <div className="relative">
                  <ArrowDownUp className="absolute left-3 top-3 text-orange-500" size={18} />
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="1"
                    className="w-full pl-10 pr-4 py-2 bg-white border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-700"
                    value={formData.exchangeRate}
                    onChange={e => setFormData({ ...formData, exchangeRate: Number(e.target.value) })}
                    placeholder="ej: 4280.50"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Ejemplo: Si 1 USD = 4,280.50 COP, ingresa 4280.50
                </p>
              </div>

              {/* Input Principal (USD o COP según selección) */}
              {activeInput === 'USD' ? (
                <div>
                  <label className="block text-xs font-medium text-emerald-700 mb-1 font-bold">
                    💵 Monto en USD (Dólares)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 text-emerald-600" size={18} />
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700 text-lg"
                      value={formData.usdAmount}
                      onChange={e => {
                        setActiveInput('USD');
                        setFormData({ ...formData, usdAmount: Number(e.target.value) });
                      }}
                      placeholder="250.00"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1 font-bold">
                    💰 Monto en COP (Pesos)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 text-blue-600" size={18} />
                    <input
                      type="number"
                      required
                      step="1"
                      min="0"
                      className="w-full pl-10 pr-4 py-3 bg-white border-2 border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-700 text-lg"
                      value={formData.totalAmount}
                      onChange={e => {
                        setActiveInput('COP');
                        setFormData({ ...formData, totalAmount: Number(e.target.value) });
                      }}
                      placeholder="1,070,125"
                    />
                  </div>
                </div>
              )}

              {/* Vista Previa del Cálculo */}
              <div className="bg-white/80 backdrop-blur p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-500 mb-1">Vista Previa:</div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-600 font-bold">USD: ${formData.usdAmount?.toFixed(2) || '0.00'}</span>
                  <span className="text-slate-400">↔</span>
                  <span className="text-blue-600 font-bold">
                    COP: ${formData.totalAmount?.toLocaleString('es-CO') || '0'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 text-center">
                  Tasa: {formData.exchangeRate || 0} COP/USD
                </div>
              </div>
            </div>
          )}

          {/* ========== NO-AIRBNB: INPUT NORMAL ========== */}
          {!isAirbnb && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total en COP ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  value={formData.totalAmount}
                  onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Entrada</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.checkInDate}
                onChange={e => setFormData({ ...formData, checkInDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Salida</label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.checkOutDate}
                onChange={e => setFormData({ ...formData, checkOutDate: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 mt-6"
          >
            <Save size={20} />
            Guardar Reserva
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReservationModal;
