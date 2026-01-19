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
    exchangeRate: 4200,
    enteredAs: 'USD'
  });

  useEffect(() => {
    if (reservationToEdit) {
      setFormData(reservationToEdit);
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
    }
  }, [reservationToEdit, isOpen, properties]);

  // Función para actualizar USD y recalcular COP
  const handleUsdChange = (usdValue: number) => {
    const rate = formData.exchangeRate || 4200;
    setFormData(prev => ({
      ...prev,
      usdAmount: usdValue,
      totalAmount: Math.round(usdValue * rate),
      enteredAs: 'USD'
    }));
  };

  // Función para actualizar COP y recalcular USD
  const handleCopChange = (copValue: number) => {
    const rate = formData.exchangeRate || 4200;
    setFormData(prev => ({
      ...prev,
      totalAmount: copValue,
      usdAmount: parseFloat((copValue / rate).toFixed(2)),
      enteredAs: 'COP'
    }));
  };

  // Función para actualizar tasa y recalcular según lo que ingresó
  const handleRateChange = (newRate: number) => {
    if (newRate <= 0) return;

    setFormData(prev => {
      // Si ingresó como USD, recalcular COP
      if (prev.enteredAs === 'USD') {
        return {
          ...prev,
          exchangeRate: newRate,
          totalAmount: Math.round((prev.usdAmount || 0) * newRate)
        };
      } else {
        // Si ingresó como COP, recalcular USD
        return {
          ...prev,
          exchangeRate: newRate,
          usdAmount: parseFloat(((prev.totalAmount || 0) / newRate).toFixed(2))
        };
      }
    });
  };

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
      reservationData.enteredAs = formData.enteredAs;
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

              {/* Tasa de Cambio - PRIMERO */}
              <div>
                <label className="block text-sm font-medium text-orange-700 mb-1 font-bold">
                  <ArrowDownUp size={14} className="inline mr-1" />
                  Tasa de Cambio (COP por cada USD)
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="1"
                  className="w-full px-4 py-2 bg-white border-2 border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-700"
                  value={formData.exchangeRate}
                  onChange={e => handleRateChange(Number(e.target.value))}
                  placeholder="ej: 4280.50"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Ejemplo: Si 1 USD = 4,280.50 COP, ingresa <strong>4280.50</strong>
                </p>
              </div>

              {/* AMBOS CAMPOS VISIBLES */}
              <div className="grid grid-cols-2 gap-3">
                {/* Campo USD */}
                <div>
                  <label className="block text-xs font-bold text-emerald-700 mb-1">
                    💵 Monto USD
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-2.5 text-emerald-600" size={16} />
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      className="w-full pl-8 pr-2 py-2 bg-white border-2 border-emerald-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700"
                      value={formData.usdAmount}
                      onChange={e => handleUsdChange(Number(e.target.value))}
                      placeholder="250"
                    />
                  </div>
                </div>

                {/* Campo COP */}
                <div>
                  <label className="block text-xs font-bold text-blue-700 mb-1">
                    💰 Monto COP
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-2.5 text-blue-600" size={16} />
                    <input
                      type="number"
                      required
                      step="1"
                      min="0"
                      className="w-full pl-8 pr-2 py-2 bg-white border-2 border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-700"
                      value={formData.totalAmount}
                      onChange={e => handleCopChange(Number(e.target.value))}
                      placeholder="1070125"
                    />
                  </div>
                </div>
              </div>

              {/* Indicador visual de qué ingresó */}
              <div className="bg-white/80 backdrop-blur p-2 rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 text-center">
                  {formData.enteredAs === 'USD' ? (
                    <span>✏️ Último editado: <strong className="text-emerald-600">USD</strong> (COP calculado automáticamente)</span>
                  ) : (
                    <span>✏️ Último editado: <strong className="text-blue-600">COP</strong> (USD calculado automáticamente)</span>
                  )}
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
