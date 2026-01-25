import React, { useState, useEffect } from 'react';
import { X, Save, Building2, MapPin, User, Percent } from 'lucide-react';
import { Property } from '../types';
import { generateId } from '../App';

interface PropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (property: Property) => void;
  propertyToEdit?: Property;
}

const PropertyModal: React.FC<PropertyModalProps> = ({ isOpen, onClose, onSave, propertyToEdit }) => {
  const [formData, setFormData] = useState<Partial<Property>>({
    name: '',
    ownerName: '',
    city: '',
    commissionRate: 10
  });

  useEffect(() => {
    if (propertyToEdit) {
      setFormData(propertyToEdit);
    } else {
      setFormData({ name: '', ownerName: '', city: '', commissionRate: 10 });
    }
  }, [propertyToEdit, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: propertyToEdit?.id || generateId(),
      name: formData.name || '',
      ownerName: formData.ownerName || '',
      city: formData.city || '',
      commissionRate: formData.commissionRate || 0
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-zinc-800 animate-fade-in">
        <div className="bg-zinc-950 p-6 flex justify-between items-center border-b border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Building2 className="text-primary-500" />
            {propertyToEdit ? 'Editar Propiedad' : 'Nueva Propiedad'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors bg-zinc-900 hover:bg-zinc-800 p-2 rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Nombre de la Propiedad</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3 text-zinc-600" size={18} />
              <input
                type="text"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-zinc-200 placeholder-zinc-700"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej. Apartamento 502"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Dueño</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-zinc-600" size={18} />
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-zinc-200 placeholder-zinc-700"
                  value={formData.ownerName}
                  onChange={e => setFormData({ ...formData, ownerName: e.target.value })}
                  placeholder="Nombre Propietario"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Comisión (%)</label>
              <div className="relative">
                <Percent className="absolute left-3 top-3 text-zinc-600" size={18} />
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-zinc-200 placeholder-zinc-700"
                  value={formData.commissionRate}
                  onChange={e => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Ciudad</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 text-zinc-600" size={18} />
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-zinc-200 placeholder-zinc-700"
                  value={formData.city}
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Ej. Medellín"
                />
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-primary-500 text-black py-3 rounded-xl font-bold hover:bg-primary-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
            >
              <Save size={20} />
              {propertyToEdit ? 'Guardar Cambios' : 'Crear Propiedad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PropertyModal;
