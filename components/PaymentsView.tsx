import React, { useState, useMemo } from 'react';
import { Reservation, Property, OwnerPayment, Platform } from '../types';
import { Wallet, ChevronRight, CheckCircle2, History, AlertCircle, DollarSign, Calendar, FileText, X, Trash2, Globe, AlertTriangle } from 'lucide-react';

interface PaymentsViewProps {
  properties: Property[];
  reservations: Reservation[];
  payments: OwnerPayment[];
  onAddPayment: (payment: OwnerPayment) => void;
  onDeletePayment: (paymentId: string) => void;
  getAirbnbCopValue: (res: Reservation) => number;
  currentLiquidationRate: number;
  isLiquidationEnabled: boolean;
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
    properties, reservations, payments, onAddPayment, onDeletePayment, getAirbnbCopValue, currentLiquidationRate, isLiquidationEnabled
}) => {
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
    
    // Date Filters for Pending View
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Payment Modal State
    const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [manualAmount, setManualAmount] = useState<number>(0);
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [excludedReservationIds, setExcludedReservationIds] = useState<Set<string>>(new Set());

    // 1. Group Pending Reservations by Owner
    const pendingByOwner = useMemo<Record<string, { totalPayout: number, count: number, reservations: Reservation[] }>>(() => {
        const groups: Record<string, { totalPayout: number, count: number, reservations: Reservation[] }> = {};
        
        reservations.forEach(res => {
            // Check if reservation is unpaid (no paymentId)
            if (res.paymentId) return;

            // Date Filter Check (INTERSECTION LOGIC)
            // Include reservation if it overlaps the selected range
            // Overlap = !(End < Start || Start > End) -> (End >= Start && Start <= End)
            // Using checkInDate and checkOutDate
            if (startDate && res.checkOutDate < startDate) return; // Ends before range starts
            if (endDate && res.checkInDate > endDate) return;     // Starts after range ends

            const prop = properties.find(p => p.id === res.propertyId);
            if (!prop) return;

            const owner = prop.ownerName;
            
            // Calculate payout for this specific reservation
            let payout = 0;
            if (res.reservationType === 'Monthly') {
                payout = res.monthlyExpensesAndOwnerPay || 0;
            } else {
                const copValue = getAirbnbCopValue(res);
                const commission = copValue * (prop.commissionRate / 100);
                payout = copValue - commission;
            }

            if (!groups[owner]) {
                groups[owner] = { totalPayout: 0, count: 0, reservations: [] };
            }

            groups[owner].totalPayout += payout;
            groups[owner].count += 1;
            groups[owner].reservations.push(res);
        });

        return groups;
    }, [reservations, properties, getAirbnbCopValue, startDate, endDate]);

    const openPaymentModal = (owner: string) => {
        const data = pendingByOwner[owner];
        if (!data) return;
        
        setSelectedOwner(owner);

        // Calculate conflicts and exclude them by default
        const initialExclusions = new Set<string>();
        data.reservations.forEach(res => {
             // Conflict: Starts before OR ends after (Partial overlap)
             // But wait, if it ends INSIDE, it's usually payable.
             // Let's mark as conflict if it ends AFTER the end date (not fully completed in period)
             // or starts BEFORE start date?
             // Actually, let's stick to the prompt: "conflict".
             // We will flag them in UI.
             // Policy: Exclude if CheckOut > EndDate (Reservation ongoing after payment period).
             // Policy: Exclude if CheckIn < StartDate? Maybe not, if it ends inside.
             // Let's exclude strictly those that end AFTER the period (EndDate).
             if (endDate && res.checkOutDate > endDate) {
                 initialExclusions.add(res.id);
             }
        });

        setExcludedReservationIds(initialExclusions);
        setManualAmount(Math.round(data.totalPayout)); // Default to calculated (will update via effect)
        setPaymentNotes('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentModalOpen(true);
    };

    // Recalculate total when exclusions change
    const displayedTotalPayout = useMemo(() => {
        if (!selectedOwner || !pendingByOwner[selectedOwner]) return 0;

        const data = pendingByOwner[selectedOwner];
        return data.reservations.reduce((sum, res) => {
            if (excludedReservationIds.has(res.id)) return sum;

            // Calculate value for this res
            const prop = properties.find(p => p.id === res.propertyId);
            if (!prop) return sum;

            if (res.reservationType === 'Monthly') {
                return sum + (res.monthlyExpensesAndOwnerPay || 0);
            }

            const copValue = getAirbnbCopValue(res);
            const commission = copValue * (prop.commissionRate / 100);
            return sum + (copValue - commission);
        }, 0);
    }, [selectedOwner, pendingByOwner, excludedReservationIds, getAirbnbCopValue, properties]);

    // Update manual amount when displayed total changes
    React.useEffect(() => {
        setManualAmount(Math.round(displayedTotalPayout));
    }, [displayedTotalPayout]);

    const toggleReservationExclusion = (id: string) => {
        setExcludedReservationIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleConfirmPayment = () => {
        if (!selectedOwner || !pendingByOwner[selectedOwner]) return;

        const data = pendingByOwner[selectedOwner];
        
        // Filter out excluded reservations
        const includedReservations = data.reservations.filter(r => !excludedReservationIds.has(r.id));

        if (includedReservations.length === 0) {
            alert("Debes incluir al menos una reserva para realizar el pago.");
            return;
        }

        const newPayment: OwnerPayment = {
            id: safeId(),
            ownerName: selectedOwner,
            date: paymentDate,
            amountPaid: manualAmount,
            expectedAmount: displayedTotalPayout,
            reservationIds: includedReservations.map(r => r.id),
            notes: paymentNotes,
            exchangeRate: isLiquidationEnabled ? currentLiquidationRate : undefined
        };

        onAddPayment(newPayment);
        setPaymentModalOpen(false);
        setSelectedOwner(null);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-24 lg:pb-12">
            {/* Header / Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 p-4 rounded-2xl shadow-sm border border-zinc-800">
                <div>
                    <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                        <Wallet className="text-primary-500" /> Control de Pagos
                    </h2>
                    <p className="text-zinc-400 text-sm">Gestiona liquidaciones a propietarios.</p>
                </div>

                {/* Date Filters (Only in Pending Mode) */}
                {viewMode === 'pending' && (
                    <div className="flex items-center gap-2 bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 pl-1">Desde</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-transparent text-sm font-medium text-zinc-300 outline-none color-scheme-dark"
                            />
                        </div>
                        <div className="w-px h-8 bg-zinc-800 mx-1"></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 pl-1">Hasta</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-transparent text-sm font-medium text-zinc-300 outline-none color-scheme-dark"
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button onClick={() => { setStartDate(''); setEndDate(''); }} className="ml-2 p-1 text-zinc-500 hover:text-red-500 rounded-full hover:bg-red-900/20 transition-colors">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                )}

                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                    <button 
                        onClick={() => setViewMode('pending')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            viewMode === 'pending' ? 'bg-zinc-800 text-primary-500 shadow-sm border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        <AlertCircle size={16} /> Pendientes
                    </button>
                    <button 
                        onClick={() => setViewMode('history')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            viewMode === 'history' ? 'bg-zinc-800 text-primary-500 shadow-sm border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'
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
                         <div className="col-span-full text-center py-12 bg-zinc-900 rounded-2xl border border-dashed border-zinc-800 text-zinc-500">
                             <CheckCircle2 size={48} className="mx-auto mb-2 text-zinc-700" />
                             <p>¡Todo al día! No hay pagos pendientes.</p>
                         </div>
                    )}
                    {Object.entries(pendingByOwner).map(([owner, data]) => (
                        <div key={owner} className="bg-zinc-900 rounded-2xl p-6 shadow-sm border border-zinc-800 hover:shadow-md hover:border-primary-500/30 transition-all relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Wallet size={64} className="text-primary-500" />
                            </div>
                            
                            <h3 className="font-bold text-lg text-zinc-100 mb-1">{owner}</h3>
                            <p className="text-sm text-zinc-400 mb-4">{data.count} reservas pendientes (rango)</p>
                            
                            <div className="mb-6">
                                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total a Pagar</p>
                                <p className="text-2xl font-bold text-primary-500">{formatCOP(data.totalPayout)}</p>
                                {isLiquidationEnabled && (
                                    <div className="mt-2 text-[10px] bg-purple-900/30 text-purple-400 px-2 py-1 rounded-lg inline-flex items-center gap-1 border border-purple-800">
                                        <Globe size={10} /> Tasa Liq.: {formatCOP(currentLiquidationRate)}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={() => openPaymentModal(owner)}
                                className="w-full bg-primary-500 text-black py-3 rounded-xl font-bold hover:bg-primary-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
                            >
                                <DollarSign size={18} /> Registrar Pago
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-zinc-950 text-zinc-500 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Fecha</th>
                                    <th className="px-6 py-4">Propietario</th>
                                    <th className="px-6 py-4">Reservas</th>
                                    <th className="px-6 py-4">Calculado</th>
                                    <th className="px-6 py-4">Tasa (USD)</th>
                                    <th className="px-6 py-4">Pagado Real</th>
                                    <th className="px-6 py-4">Notas</th>
                                    <th className="px-6 py-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {payments.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-zinc-500">
                                            No hay historial de pagos registrados.
                                        </td>
                                    </tr>
                                )}
                                {[...payments].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((pay) => (
                                    <tr key={pay.id} className="hover:bg-zinc-800/50">
                                        <td className="px-6 py-4 text-zinc-400 text-sm whitespace-nowrap">{pay.date}</td>
                                        <td className="px-6 py-4 font-medium text-zinc-200">{pay.ownerName}</td>
                                        <td className="px-6 py-4 text-zinc-500 text-xs">
                                            <span className="bg-zinc-800 px-2 py-1 rounded-md">{pay.reservationIds.length} res.</span>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-600 text-sm line-through decoration-zinc-700">{formatCOP(pay.expectedAmount)}</td>
                                        <td className="px-6 py-4 text-zinc-500 text-xs font-mono">
                                            {pay.exchangeRate ? formatCOP(pay.exchangeRate) : '-'}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-emerald-500">{formatCOP(pay.amountPaid)}</td>
                                        <td className="px-6 py-4 text-zinc-500 text-sm italic max-w-xs truncate">{pay.notes || '-'}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => {
                                                    if(window.confirm(`¿Eliminar este pago de ${pay.ownerName}? Las reservas volverán a estar pendientes.`)) {
                                                        onDeletePayment(pay.id);
                                                    }
                                                }}
                                                className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition-colors"
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
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-zinc-900 rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in overflow-hidden max-h-[85vh] flex flex-col border border-zinc-800">
                        <div className="bg-primary-500 p-6 text-black flex justify-between items-start flex-shrink-0">
                            <div>
                                <h3 className="text-lg font-bold opacity-80">Registrar Pago</h3>
                                <h2 className="text-2xl font-black">{selectedOwner}</h2>
                            </div>
                            <button onClick={() => setPaymentModalOpen(false)} className="text-black/60 hover:text-black bg-black/10 hover:bg-black/20 p-2 rounded-full backdrop-blur-md">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                            {/* Summary Box */}
                            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800 flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-zinc-500 font-bold uppercase">Monto Calculado</p>
                                    <div className="text-sm text-zinc-300 flex items-center gap-1">
                                        <span>{pendingByOwner[selectedOwner].reservations.length} total</span>
                                        {excludedReservationIds.size > 0 && <span className="text-red-400 font-bold">(-{excludedReservationIds.size} excluidas)</span>}
                                    </div>
                                    {isLiquidationEnabled && (
                                        <div className="text-[10px] text-primary-500 mt-1 flex items-center gap-1">
                                            <Globe size={10} /> Tasa: {formatCOP(currentLiquidationRate)}
                                        </div>
                                    )}
                                </div>
                                <div className="text-xl font-bold text-primary-500">
                                    {formatCOP(displayedTotalPayout)}
                                </div>
                            </div>

                            {/* Editable Fields */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-1">Monto Real a Pagar</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-3 text-zinc-500" size={18} />
                                        <input 
                                            type="number" 
                                            value={manualAmount}
                                            onChange={(e) => setManualAmount(Number(e.target.value))}
                                            className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-bold text-zinc-100 text-lg"
                                        />
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">Edita este valor si pagaste una cantidad diferente a la calculada.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-400 mb-1">Fecha Pago</label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-3 text-zinc-500" size={18} />
                                            <input 
                                                type="date"
                                                value={paymentDate}
                                                onChange={(e) => setPaymentDate(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-zinc-200 color-scheme-dark"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-zinc-400 mb-1">Notas (Opcional)</label>
                                        <div className="relative">
                                            <FileText className="absolute left-3 top-3 text-zinc-500" size={18} />
                                            <input 
                                                type="text"
                                                placeholder="Ej. Transferencia Bancolombia..."
                                                value={paymentNotes}
                                                onChange={(e) => setPaymentNotes(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 text-zinc-200"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* List of included reservations */}
                            <div className="border-t border-zinc-800 pt-4">
                                <p className="text-xs font-bold text-zinc-500 uppercase mb-2">Detalle de Reservas</p>
                                <div className="space-y-2 pr-2">
                                    {pendingByOwner[selectedOwner].reservations.map(res => {
                                        const prop = properties.find(p => p.id === res.propertyId);
                                        const isMonthly = res.reservationType === 'Monthly';
                                        const isConflict = (startDate && res.checkInDate < startDate) || (endDate && res.checkOutDate > endDate);

                                        return (
                                            <div key={res.id} className={`flex items-center text-xs p-2 rounded-lg transition-colors ${excludedReservationIds.has(res.id) ? 'bg-zinc-950 opacity-50' : 'bg-zinc-800'} ${isConflict ? 'border border-amber-900/50 bg-amber-900/10' : ''}`}>
                                                <div className="mr-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={!excludedReservationIds.has(res.id)}
                                                        onChange={() => toggleReservationExclusion(res.id)}
                                                        className={`w-4 h-4 rounded focus:ring-primary-500 border-zinc-600 bg-zinc-900 ${isConflict ? 'text-amber-500' : 'text-emerald-500'}`}
                                                    />
                                                </div>

                                                <div className="flex-1 flex justify-between items-center">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            <span className={`font-medium ${excludedReservationIds.has(res.id) ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                                                                {res.guestName}
                                                            </span>
                                                            {isMonthly && <span className="text-[10px] bg-purple-900/30 text-purple-400 px-1 rounded font-bold border border-purple-800">MENSUAL</span>}
                                                            {isConflict && <span className="text-[10px] bg-amber-900/30 text-amber-500 px-1 rounded font-bold flex items-center gap-0.5 border border-amber-800"><AlertTriangle size={8}/>CONFLICTO</span>}
                                                        </div>
                                                        <div className="text-zinc-500 flex items-center gap-1 mt-0.5">
                                                            <span>{prop?.name}</span>
                                                            <span className="text-zinc-600">•</span>
                                                            <span className={isConflict ? 'text-amber-500 font-bold' : ''}>{res.checkInDate} / {res.checkOutDate}</span>
                                                        </div>
                                                    </div>
                                                    {!excludedReservationIds.has(res.id) && <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 pt-4 border-t border-zinc-800 bg-zinc-900 flex-shrink-0">
                            <button 
                                onClick={handleConfirmPayment}
                                className="w-full bg-primary-500 text-black py-3.5 rounded-xl font-bold text-lg hover:bg-primary-400 transition-transform active:scale-95 shadow-lg shadow-primary-500/20"
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
