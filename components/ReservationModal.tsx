import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, DollarSign, User, Globe } from 'lucide-react';
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
    checkOutDate: ''
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
        checkOutDate: new Date().toISOString().split('T')[0]
      });
    }
  }, [reservationToEdit, isOpen, properties]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propertyId || !formData.guestName) return;

    onSave({
      id: reservationToEdit?.id || safeId(),
      propertyId: formData.propertyId,
      guestName: formData.guestName,
      totalAmount: Number(formData.totalAmount),
      usdAmount: formData.platform === Platform.Airbnb ? Number(formData.usdAmount) : undefined,
      platform: formData.platform as Platform,
      checkInDate: formData.checkInDate || '',
      checkOutDate: formData.checkOutDate || ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Huesped</label>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plataforma</label>
              <div className="relative">
                <Globe className="absolute left-3 top-3 text-slate-400" size={18} />
                <select
                  className="w-full pl-10 pr-2 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none font-semibold"
                  value={formData.platform}
                  onChange={e => setFormData({ ...formData, platform: e.target.value as Platform })}
                >
                  {Object.values(Platform).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
               {formData.platform === Platform.Airbnb ? (
                 <>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Monto en USD ($)</label>
                   <div className="relative">
                    <DollarSign className="absolute left-3 top-3 text-emerald-500" size={18} />
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      className="w-full pl-10 pr-4 py-2 bg-emerald-50/30 border border-emerald-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-700"
                      value={formData.usdAmount}
                      onChange={e => setFormData({ ...formData, usdAmount: Number(e.target.value) })}
                    />
                  </div>
                 </>
               ) : (
                 <>
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
                 </>
               )}
            </div>
          </div>

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