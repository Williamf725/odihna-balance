import React, { useState, useMemo } from 'react';
import { Reservation, Property, OwnerPayment, Platform } from '../types';
import { Wallet, ChevronRight, CheckCircle2, History, AlertCircle, DollarSign, Calendar, FileText, X, Trash2 } from 'lucide-react';

interface PaymentsViewProps {
  properties: Property[];
  reservations: Reservation[];
  payments: OwnerPayment[];
  onAddPayment: (payment: OwnerPayment) => void;
  onDeletePayment: (paymentId: string) => void;
  getAirbnbCopValue: (res: Reservation) => number;
}

const safeId = () => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {}
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// Formatter
const formatCOP = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const PaymentsView: React.FC<PaymentsViewProps> = ({ 
    properties, reservations, payments, onAddPayment, onDeletePayment, getAirbnbCopValue 
}) => {
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
    
    // Payment Modal State
    const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [manualAmount, setManualAmount] = useState<number>(0);
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

    // 1. Group Pending Reservations by Owner
    const pendingByOwner = useMemo(() => {
        const groups: Record<string, { totalPayout: number, count: number, reservations: Reservation[] }> = {};
        
        reservations.forEach(res => {
            // Check if reservation is unpaid (no paymentId)
            if (res.paymentId) return;

            const prop = properties.find(p => p.id === res.propertyId);
            if (!prop) return;

            const owner = prop.ownerName;
            
            // Calculate payout for this specific reservation
            const copValue = getAirbnbCopValue(res);
            const commission = copValue * (prop.commissionRate / 100);
            const payout = copValue - commission;

            if (!groups[owner]) {
                groups[owner] = { totalPayout: 0, count: 0, reservations: [] };
            }

            groups[owner].totalPayout += payout;
            groups[owner].count += 1;
            groups[owner].reservations.push(res);
        });

        return groups;
    }, [reservations, properties, getAirbnbCopValue]);

    const openPaymentModal = (owner: string) => {
        const data = pendingByOwner[owner];
        if (!data) return;
        
        setSelectedOwner(owner);
        setManualAmount(Math.round(data.totalPayout)); // Default to calculated
        setPaymentNotes('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentModalOpen(true);
    };

    const handleConfirmPayment = () => {
        if (!selectedOwner || !pendingByOwner[selectedOwner]) return;

        const data = pendingByOwner[selectedOwner];
        
        const newPayment: OwnerPayment = {
            id: safeId(),
            ownerName: selectedOwner,
            date: paymentDate,
            amountPaid: manualAmount,
            expectedAmount: data.totalPayout,
            reservationIds: data.reservations.map(r => r.id),
            notes: paymentNotes
        };

        onAddPayment(newPayment);
        setPaymentModalOpen(false);
        setSelectedOwner(null);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-24 lg:pb-12">
            {/* Header / Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="text-emerald-500" /> Control de Pagos
                    </h2>
                    <p className="text-slate-500 text-sm">Gestiona liquidaciones a propietarios.</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                        onClick={() => setViewMode('pending')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            viewMode === 'pending' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <AlertCircle size={16} /> Pendientes
                    </button>
                    <button 
                        onClick={() => setViewMode('history')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            viewMode === 'history' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <History size={16} /> Historial
                    </button>
                </div>
            </div>

            {/* Content */}
            {viewMode === 'pending' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.keys(pendingByOwner).length === 0 && (
                         <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
                             <CheckCircle2 size={48} className="mx-auto mb-2 text-emerald-200" />
                             <p>¡Todo al día! No hay pagos pendientes.</p>
                         </div>
                    )}
                    {Object.entries(pendingByOwner).map(([owner, data]) => (
                        <div key={owner} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Wallet size={64} className="text-emerald-500" />
                            </div>
                            
                            <h3 className="font-bold text-lg text-slate-800 mb-1">{owner}</h3>
                            <p className="text-sm text-slate-500 mb-4">{data.count} reservas pendientes</p>
                            
                            <div className="mb-6">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total a Pagar</p>
                                <p className="text-2xl font-bold text-emerald-600">{formatCOP(data.totalPayout)}</p>
                            </div>

                            <button 
                                onClick={() => openPaymentModal(owner)}
                                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                            >
                                <DollarSign size={18} /> Registrar Pago
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Propietario</th>
                                    <th className="px-6 py-4">Reservas</th>
                                    <th className="px-6 py-4">Calculado</th>
                                    <th className="px-6 py-4">Pagado Real</th>
                                    <th className="px-6 py-4">Notas</th>
                                    <th className="px-6 py-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {payments.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                                            No hay historial de pagos registrados.
                                        </td>
                                    </tr>
                                )}
                                {[...payments].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((pay) => (
                                    <tr key={pay.id} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-4 text-slate-600 text-sm whitespace-nowrap">{pay.date}</td>
                                        <td className="px-6 py-4 font-medium text-slate-800">{pay.ownerName}</td>
                                        <td className="px-6 py-4 text-slate-600 text-xs">
                                            <span className="bg-slate-100 px-2 py-1 rounded-md">{pay.reservationIds.length} res.</span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-400 text-sm line-through decoration-slate-300">{formatCOP(pay.expectedAmount)}</td>
                                        <td className="px-6 py-4 font-bold text-emerald-600">{formatCOP(pay.amountPaid)}</td>
                                        <td className="px-6 py-4 text-slate-500 text-sm italic max-w-xs truncate">{pay.notes || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => {
                                                    if(window.confirm(`¿Eliminar este pago de ${pay.ownerName}? Las reservas volverán a estar pendientes.`)) {
                                                        onDeletePayment(pay.id);
                                                    }
                                                }}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Eliminar pago y restaurar deuda"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PAYMENT MODAL */}
            {paymentModalOpen && selectedOwner && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden">
                        <div className="bg-emerald-600 p-6 text-white flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold opacity-90">Registrar Pago</h3>
                                <h2 className="text-2xl font-bold">{selectedOwner}</h2>
                            </div>
                            <button onClick={() => setPaymentModalOpen(false)} className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-md">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Summary Box */}
                            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-emerald-600 font-bold uppercase">Monto Calculado (Reservas)</p>
                                    <p className="text-sm text-emerald-800">{pendingByOwner[selectedOwner].count} reservas seleccionadas</p>
                                </div>
                                <div className="text-xl font-bold text-emerald-700">
                                    {formatCOP(pendingByOwner[selectedOwner].totalPayout)}
                                </div>
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto Real a Pagar</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input 
                                            type="number" 
                                            value={manualAmount}
                                            onChange={(e) => setManualAmount(Number(e.target.value))}
                                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-bold text-slate-800 text-lg"
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Edita este valor si pagaste una cantidad diferente a la calculada.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Pago</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
                                            <input 
                                                type="date"
                                                value={paymentDate}
                                                onChange={(e) => setPaymentDate(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Notas (Opcional)</label>
                                        <div className="relative">
                                            <FileText className="absolute left-3 top-3 text-slate-400" size={18} />
                                            <input 
                                                type="text"
                                                placeholder="Ej. Transferencia Bancolombia..."
                                                value={paymentNotes}
                                                onChange={(e) => setPaymentNotes(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* List of included reservations */}
                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Detalle de Reservas Incluidas</p>
                                <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                                    {pendingByOwner[selectedOwner].reservations.map(res => {
                                        const prop = properties.find(p => p.id === res.propertyId);
                                        return (
                                            <div key={res.id} className="flex justify-between items-center text-xs p-2 bg-slate-50 rounded-lg">
                                                <div>
                                                    <span className="font-medium text-slate-700">{res.guestName}</span>
                                                    <span className="text-slate-400 mx-1">•</span>
                                                    <span className="text-slate-500">{prop?.name}</span>
                                                </div>
                                                <span className="text-slate-600">{res.checkInDate}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button 
                                onClick={handleConfirmPayment}
                                className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-transform active:scale-95 shadow-lg shadow-emerald-200"
                            >
                                Confirmar Pago
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentsView;
