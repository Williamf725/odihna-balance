import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, DollarSign, User, Globe, ArrowDownUp, TrendingUp, CalendarRange } from 'lucide-react';
import { Reservation, Property, Platform, ReservationType } from '../types';

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

// Helper para calcular meses entre dos fechas
const calculateMonths = (startDate: string, endDate: string): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                 (end.getMonth() - start.getMonth());
  
  // Si el día final es mayor o igual al día inicial, suma 1 mes completo
  if (end.getDate() >= start.getDate()) {
    return months + 1;
  }
  
  return months;
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
    enteredAs: 'USD',
    reservationType: ReservationType.Standard,
    monthlyExpensesAndOwnerPay: 0,
    monthsCount: 0
  });

  const [activeInput, setActiveInput] = useState<'COP' | 'USD'>('USD');

  useEffect(() => {
    if (reservationToEdit) {
      setFormData(reservationToEdit);
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
        enteredAs: 'USD',
        reservationType: ReservationType.Standard,
        monthlyExpensesAndOwnerPay: 0,
        monthsCount: 0
      });
      setActiveInput('USD');
    }
  }, [reservationToEdit, isOpen, properties]);

  // Calcular automáticamente meses cuando cambian las fechas (solo para Monthly)
  useEffect(() => {
    if (formData.reservationType === ReservationType.Monthly && 
        formData.checkInDate && 
        formData.checkOutDate) {
      const months = calculateMonths(formData.checkInDate, formData.checkOutDate);
      setFormData(prev => ({ ...prev, monthsCount: months }));
    }
  }, [formData.checkInDate, formData.checkOutDate, formData.reservationType]);

  // Calcular automáticamente conversión USD-COP (solo para Airbnb Standard)
  useEffect(() => {
    if (formData.platform !== Platform.Airbnb || 
        formData.reservationType !== ReservationType.Standard) return;
    if (!formData.exchangeRate || formData.exchangeRate <= 0) return;

    if (activeInput === 'USD' && formData.usdAmount !== undefined) {
      const calculatedCOP = formData.usdAmount * formData.exchangeRate;
      setFormData(prev => ({ ...prev, totalAmount: Math.round(calculatedCOP) }));
    } else if (activeInput === 'COP' && formData.totalAmount !== undefined) {
      const calculatedUSD = formData.totalAmount / formData.exchangeRate;
      setFormData(prev => ({ ...prev, usdAmount: parseFloat(calculatedUSD.toFixed(2)) }));
    }
  }, [formData.usdAmount, formData.totalAmount, formData.exchangeRate, activeInput, formData.platform, formData.reservationType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propertyId || !formData.guestName) return;

    // Validación para Airbnb Standard
    if (formData.platform === Platform.Airbnb && 
        formData.reservationType === ReservationType.Standard) {
      if (!formData.exchangeRate || formData.exchangeRate <= 0) {
        alert('Por favor ingresa una tasa de cambio válida para Airbnb');
        return;
      }
      if (!formData.usdAmount || formData.usdAmount <= 0) {
        alert('Por favor ingresa un monto válido');
        return;
      }
    }

    // Validación para Monthly
    if (formData.reservationType === ReservationType.Monthly) {
      if (!formData.totalAmount || formData.totalAmount <= 0) {
        alert('Por favor ingresa el valor mensual total de la reserva');
        return;
      }
      if (formData.monthlyExpensesAndOwnerPay === undefined || 
          formData.monthlyExpensesAndOwnerPay < 0) {
        alert('Por favor ingresa el valor de gastos + pago al dueño');
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
      checkOutDate: formData.checkOutDate || '',
      reservationType: formData.reservationType || ReservationType.Standard
    };

    // Campos específicos para Airbnb Standard
    if (formData.platform === Platform.Airbnb && 
        formData.reservationType === ReservationType.Standard) {
      reservationData.usdAmount = Number(formData.usdAmount);
      reservationData.exchangeRate = Number(formData.exchangeRate);
      reservationData.enteredAs = activeInput;
    }

    // Campos específicos para Monthly
    if (formData.reservationType === ReservationType.Monthly) {
      reservationData.monthlyExpensesAndOwnerPay = Number(formData.monthlyExpensesAndOwnerPay);
      reservationData.monthsCount = formData.monthsCount;
    }

    onSave(reservationData);
    onClose();
  };

  if (!isOpen) return null;

  const isAirbnb = formData.platform === Platform.Airbnb;
  const isMonthly = formData.reservationType === ReservationType.Monthly;
  const myEarnings = isMonthly 
    ? (formData.totalAmount || 0) - (formData.monthlyExpensesAndOwnerPay || 0)
    : 0;

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

          {/* ========== SELECTOR DE TIPO DE RESERVA ========== */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Reserva</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, reservationType: ReservationType.Standard })}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  formData.reservationType === ReservationType.Standard
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                }`}
              >
                📅 Estándar
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, reservationType: ReservationType.Monthly })}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  formData.reservationType === ReservationType.Monthly
                    ? 'bg-purple-500 text-white shadow-lg'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
                }`}
              >
                📆 Mensual
              </button>
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

          {/* ========== SECCIÓN AIRBNB (Solo para Standard) ========== */}
          {isAirbnb && !isMonthly && (
            <div className="bg-gradient-to-br from-emerald-50 to-blue-50 p-4 rounded-xl border-2 border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm mb-2">
                <TrendingUp size={16} />
                Configuración Airbnb
              </div>

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
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                      onChange={e => {
                        setActiveInput('USD');
                        setFormData({ ...formData, usdAmount: Number(e.target.value) });
                      }}
                      placeholder="250"
                    />
                  </div>
                </div>

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
                      onChange={e => {
                        setActiveInput('COP');
                        setFormData({ ...formData, totalAmount: Number(e.target.value) });
                      }}
                      placeholder="1070125"
                    />
                  </div>
                </div>
              </div>

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

          {/* ========== SECCIÓN RESERVA MENSUAL ========== */}
          {isMonthly && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border-2 border-purple-200 space-y-3">
              <div className="flex items-center gap-2 text-purple-700 font-bold text-sm mb-2">
                <CalendarRange size={16} />
                Reserva Mensual
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  💰 Valor Mensual Total (COP)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 text-purple-600" size={18} />
                  <input
                    type="number"
                    required
                    step="1"
                    min="0"
                    className="w-full pl-10 pr-4 py-2 bg-white border-2 border-purple-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold text-purple-700"
                    value={formData.totalAmount}
                    onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                    placeholder="1000000"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Valor total que cobra la reserva por mes
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  🧾 Gastos + Pago al Dueño (COP)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 text-orange-600" size={18} />
                  <input
                    type="number"
                    required
                    step="1"
                    min="0"
                    max={formData.totalAmount}
                    className="w-full pl-10 pr-4 py-2 bg-white border-2 border-orange-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-700"
                    value={formData.monthlyExpensesAndOwnerPay}
                    onChange={e => setFormData({ ...formData, monthlyExpensesAndOwnerPay: Number(e.target.value) })}
                    placeholder="800000"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Total de gastos más lo que le pagas al dueño
                </p>
              </div>

              {/* Vista Previa de Ganancias */}
              <div className="bg-white/80 backdrop-blur p-3 rounded-lg border border-purple-300">
                <div className="text-xs text-slate-600 mb-2 font-bold">📊 Resumen Financiero:</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Valor Mensual:</span>
                    <span className="font-bold text-purple-700">
                      ${formData.totalAmount?.toLocaleString('es-CO') || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Gastos + Pago Dueño:</span>
                    <span className="font-bold text-orange-600">
                      -${formData.monthlyExpensesAndOwnerPay?.toLocaleString('es-CO') || '0'}
                    </span>
                  </div>
                  <div className="border-t border-purple-200 pt-1 flex justify-between">
                    <span className="text-slate-700 font-bold">Tu Ganancia:</span>
                    <span className={`font-bold ${myEarnings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ${myEarnings.toLocaleString('es-CO')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========== VALOR EN COP (Solo para NO-Airbnb y NO-Monthly) ========== */}
          {!isAirbnb && !isMonthly && (
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

          {/* ========== FECHAS ========== */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isMonthly ? 'Inicio Arriendo' : 'Entrada'}
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.checkInDate}
                onChange={e => setFormData({ ...formData, checkInDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {isMonthly ? 'Fin Arriendo' : 'Salida'}
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.checkOutDate}
                onChange={e => setFormData({ ...formData, checkOutDate: e.target.value })}
              />
            </div>
          </div>

          {/* Mostrar cantidad de meses para reservas mensuales */}
          {isMonthly && formData.checkInDate && formData.checkOutDate && (
            <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
              <div className="text-center">
                <span className="text-sm text-purple-700 font-bold">
                  📆 Duración: {formData.monthsCount} {formData.monthsCount === 1 ? 'mes' : 'meses'}
                </span>
              </div>
            </div>
          )}

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
