import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, User, DollarSign, Globe, Building2, CalendarRange } from 'lucide-react';
import { Property, Reservation, Platform, ReservationType } from '../types';
import { generateId } from '../App';

interface ReservationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (reservation: Reservation) => void;
  properties: Property[];
  reservationToEdit?: Reservation;
}

const ReservationModal: React.FC<ReservationModalProps> = ({ isOpen, onClose, onSave, properties, reservationToEdit }) => {
  const [formData, setFormData] = useState<Partial<Reservation>>({
    propertyId: '',
    guestName: '',
    checkInDate: '',
    checkOutDate: '',
    platform: Platform.Airbnb,
    reservationType: ReservationType.Standard,
    totalAmount: 0,
    usdAmount: 0,
    exchangeRate: 0,
    enteredAs: 'USD',
    monthlyExpensesAndOwnerPay: 0,
    monthsCount: 1
  });

  const [activeInput, setActiveInput] = useState<'USD' | 'COP'>('USD');

  // Load data for editing
  useEffect(() => {
    if (reservationToEdit) {
      setFormData(reservationToEdit);
      if (reservationToEdit.enteredAs) setActiveInput(reservationToEdit.enteredAs);
    } else {
      // Defaults
      setFormData({
        propertyId: properties[0]?.id || '',
        guestName: '',
        checkInDate: '',
        checkOutDate: '',
        platform: Platform.Airbnb,
        reservationType: ReservationType.Standard,
        totalAmount: 0,
        usdAmount: 0,
        exchangeRate: 4200, // Default prompt
        enteredAs: 'USD',
        monthlyExpensesAndOwnerPay: 0,
        monthsCount: 1
      });
    }
  }, [reservationToEdit, isOpen, properties]);

  // Auto-calculation Effect for Airbnb
  useEffect(() => {
    if (formData.platform === Platform.Airbnb && formData.reservationType === ReservationType.Standard) {
        const rate = formData.exchangeRate || 0;

        if (activeInput === 'USD') {
            const usd = formData.usdAmount || 0;
            const calculatedCop = Math.round(usd * rate);
            if (calculatedCop !== formData.totalAmount) {
                setFormData(prev => ({ ...prev, totalAmount: calculatedCop }));
            }
        } else {
            const cop = formData.totalAmount || 0;
            const calculatedUsd = rate > 0 ? Number((cop / rate).toFixed(2)) : 0;
            if (calculatedUsd !== formData.usdAmount) {
                setFormData(prev => ({ ...prev, usdAmount: calculatedUsd }));
            }
        }
    }
  }, [formData.usdAmount, formData.totalAmount, formData.exchangeRate, activeInput, formData.platform]);

  // Auto-calculate months count
  useEffect(() => {
      if (formData.reservationType === ReservationType.Monthly && formData.checkInDate && formData.checkOutDate) {
          const start = new Date(formData.checkInDate);
          const end = new Date(formData.checkOutDate);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          const months = Math.max(1, Math.round(diffDays / 30));
          setFormData(prev => ({ ...prev, monthsCount: months }));
      }
  }, [formData.checkInDate, formData.checkOutDate, formData.reservationType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: reservationToEdit?.id || generateId(),
      propertyId: formData.propertyId || '',
      guestName: formData.guestName || '',
      checkInDate: formData.checkInDate || '',
      checkOutDate: formData.checkOutDate || '',
      platform: formData.platform || Platform.Direct,
      reservationType: formData.reservationType || ReservationType.Standard,
      totalAmount: Number(formData.totalAmount) || 0,
      usdAmount: formData.platform === Platform.Airbnb ? Number(formData.usdAmount) : undefined,
      exchangeRate: formData.platform === Platform.Airbnb ? Number(formData.exchangeRate) : undefined,
      enteredAs: activeInput,
      paymentId: reservationToEdit?.paymentId, // Preserve payment link
      monthlyExpensesAndOwnerPay: formData.reservationType === ReservationType.Monthly ? Number(formData.monthlyExpensesAndOwnerPay) : undefined,
      monthsCount: formData.reservationType === ReservationType.Monthly ? Number(formData.monthsCount) : undefined
    });
    onClose();
  };

  if (!isOpen) return null;

  const isAirbnb = formData.platform === Platform.Airbnb;
  const isMonthly = formData.reservationType === ReservationType.Monthly;
  const myEarnings = (formData.totalAmount || 0) - (formData.monthlyExpensesAndOwnerPay || 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-800 animate-fade-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-zinc-950 p-6 flex justify-between items-center border-b border-zinc-800 shrink-0">
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Calendar className="text-primary-500" />
            {reservationToEdit ? 'Editar Reserva' : 'Nueva Reserva'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors bg-zinc-900 hover:bg-zinc-800 p-2 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">

          {/* ========== SELECCIÓN PROPIEDAD Y TIPO ========== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Propiedad</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-3 text-zinc-600" size={18} />
                <select
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-zinc-200"
                  value={formData.propertyId}
                  onChange={e => setFormData({ ...formData, propertyId: e.target.value })}
                >
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Tipo de Reserva</label>
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, reservationType: ReservationType.Standard })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${!isMonthly ? 'bg-zinc-800 text-primary-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Estándar
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, reservationType: ReservationType.Monthly })}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${isMonthly ? 'bg-purple-900/40 text-purple-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Mensual
                </button>
              </div>
            </div>
          </div>

          {/* ========== DATOS BÁSICOS ========== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Huésped</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-zinc-600" size={18} />
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-zinc-200"
                  value={formData.guestName}
                  onChange={e => setFormData({ ...formData, guestName: e.target.value })}
                  placeholder="Nombre del cliente"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Plataforma</label>
              <div className="grid grid-cols-3 gap-2">
                {[Platform.Airbnb, Platform.Booking, Platform.Direct].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setFormData({ ...formData, platform: p })}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      formData.platform === p
                        ? 'bg-primary-500 text-black border-primary-600'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-600'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ========== SECCIÓN AIRBNB (USD LOGIC) ========== */}
          {isAirbnb && !isMonthly && (
            <div className="bg-emerald-900/10 p-4 rounded-xl border border-emerald-900/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <Globe size={16} />
                  Conversión de Divisas
                </div>
                <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1 rounded-lg border border-emerald-900/30">
                  <span className="text-[10px] text-emerald-500 uppercase font-bold">Tasa Cambio:</span>
                  <input
                    type="number"
                    className="w-20 bg-transparent text-right font-mono text-sm text-emerald-300 focus:outline-none"
                    value={formData.exchangeRate}
                    onChange={e => setFormData({ ...formData, exchangeRate: Number(e.target.value) })}
                    placeholder="ej: 4280.50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-500 mb-1">
                    💵 Monto USD
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-2.5 text-emerald-600" size={16} />
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      className="w-full pl-8 pr-2 py-2 bg-zinc-900 border border-emerald-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-400 placeholder-emerald-900/50"
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
                  <label className="block text-xs font-bold text-blue-400 mb-1">
                    💰 Monto COP
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-2.5 text-blue-600" size={16} />
                    <input
                      type="number"
                      required
                      step="1"
                      min="0"
                      className="w-full pl-8 pr-2 py-2 bg-zinc-900 border border-blue-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-400 placeholder-blue-900/50"
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

              <div className="bg-zinc-900/50 p-2 rounded-lg border border-emerald-900/20">
                <div className="text-[10px] text-zinc-500 text-center">
                  {formData.enteredAs === 'USD' ? (
                    <span>✏️ Último editado: <strong className="text-emerald-500">USD</strong> (COP calculado automáticamente)</span>
                  ) : (
                    <span>✏️ Último editado: <strong className="text-blue-500">COP</strong> (USD calculado automáticamente)</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========== SECCIÓN RESERVA MENSUAL ========== */}
          {isMonthly && (
            <div className="bg-purple-900/10 p-4 rounded-xl border border-purple-900/30 space-y-3">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-sm mb-2">
                <CalendarRange size={16} />
                Reserva Mensual
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  💰 Valor Mensual Total (COP)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 text-purple-500" size={18} />
                  <input
                    type="number"
                    required
                    step="1"
                    min="0"
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-purple-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-bold text-purple-400 placeholder-purple-900/50"
                    value={formData.totalAmount}
                    onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                    placeholder="1000000"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Valor total que cobra la reserva por mes
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  🧾 Gastos + Pago al Dueño (COP)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 text-orange-500" size={18} />
                  <input
                    type="number"
                    required
                    step="1"
                    min="0"
                    max={formData.totalAmount}
                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-orange-900/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-400 placeholder-orange-900/50"
                    value={formData.monthlyExpensesAndOwnerPay}
                    onChange={e => setFormData({ ...formData, monthlyExpensesAndOwnerPay: Number(e.target.value) })}
                    placeholder="800000"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Total de gastos más lo que le pagas al dueño
                </p>
              </div>

              {/* Vista Previa de Ganancias */}
              <div className="bg-zinc-900/80 p-3 rounded-lg border border-purple-900/30">
                <div className="text-xs text-zinc-400 mb-2 font-bold">📊 Resumen Financiero:</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Valor Mensual:</span>
                    <span className="font-bold text-purple-400">
                      ${formData.totalAmount?.toLocaleString('es-CO') || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Gastos + Pago Dueño:</span>
                    <span className="font-bold text-orange-400">
                      -${formData.monthlyExpensesAndOwnerPay?.toLocaleString('es-CO') || '0'}
                    </span>
                  </div>
                  <div className="border-t border-zinc-700 pt-1 flex justify-between">
                    <span className="text-zinc-300 font-bold">Tu Ganancia:</span>
                    <span className={`font-bold ${myEarnings >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
              <label className="block text-sm font-medium text-zinc-400 mb-1">Total en COP ($)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 text-zinc-600" size={18} />
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-zinc-200"
                  value={formData.totalAmount}
                  onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                />
              </div>
            </div>
          )}

          {/* ========== FECHAS ========== */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                {isMonthly ? 'Inicio Arriendo' : 'Entrada'}
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-zinc-300 color-scheme-dark"
                value={formData.checkInDate}
                onChange={e => setFormData({ ...formData, checkInDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                {isMonthly ? 'Fin Arriendo' : 'Salida'}
              </label>
              <input
                type="date"
                required
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-zinc-300 color-scheme-dark"
                value={formData.checkOutDate}
                onChange={e => setFormData({ ...formData, checkOutDate: e.target.value })}
              />
            </div>
          </div>

          {/* Mostrar cantidad de meses para reservas mensuales */}
          {isMonthly && formData.checkInDate && formData.checkOutDate && (
            <div className="bg-purple-900/20 border border-purple-900/50 rounded-lg p-3">
              <div className="text-center">
                <span className="text-sm text-purple-400 font-bold">
                  📆 Duración: {formData.monthsCount} {formData.monthsCount === 1 ? 'mes' : 'meses'}
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-primary-500 text-black py-3 rounded-xl font-bold hover:bg-primary-400 transition-colors flex items-center justify-center gap-2 mt-6 shadow-lg shadow-primary-500/20"
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
