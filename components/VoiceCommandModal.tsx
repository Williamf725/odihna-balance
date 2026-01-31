import React, { useState, useEffect } from 'react';
import { Mic, X, Loader2, Check } from 'lucide-react';
import { Property, Reservation, Platform, AppAction } from '../types';
import { generateId } from '../App';
import { parseVoiceCommand } from '../services/geminiService';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  onAddProperty: (prop: Property) => void;
  onAddReservation: (res: Reservation) => void;
}

const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({ isOpen, onClose, properties, onAddProperty, onAddReservation }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (isOpen) {
      startListening();
    } else {
      stopListening();
      setTranscript('');
      setFeedback('');
    }
  }, [isOpen]);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      setFeedback("Tu navegador no soporta voz.");
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      processCommand(text);
    };

    recognition.start();
  };

  const stopListening = () => {
    setIsListening(false);
  };

  const processCommand = async (text: string) => {
    setProcessing(true);
    try {
        const result = await parseVoiceCommand(text, properties);
        
        if (result.type === 'property' && result.data) {
             onAddProperty({ ...result.data, id: generateId() });
             setFeedback(`✅ ${result.message}`);
        } else if (result.type === 'reservation' && result.data) {
             onAddReservation({ ...result.data, id: generateId() });
             setFeedback(`✅ ${result.message}`);
        } else {
             setFeedback(`❓ ${result.message || "No pude entender el comando."}`);
        }
    } catch (e) {
        console.error(e);
        setFeedback("❌ Error al procesar.");
    } finally {
        setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-zinc-800 animate-fade-in relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={24} />
        </button>

        <div className="p-8 flex flex-col items-center text-center space-y-6">
            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isListening ? 'bg-primary-500 shadow-[0_0_40px_rgba(234,179,8,0.4)]' : 'bg-zinc-800'}`}>
                {isListening ? (
                    <Mic size={40} className="text-black animate-pulse" />
                ) : (
                    <Mic size={40} className="text-zinc-500" />
                )}
                {/* Rings animation */}
                {isListening && (
                    <>
                        <div className="absolute inset-0 rounded-full border-2 border-primary-500/50 animate-ping" />
                        <div className="absolute -inset-4 rounded-full border border-primary-500/20 animate-pulse delay-75" />
                    </>
                )}
            </div>

            <div className="space-y-2">
                <h3 className="text-2xl font-bold text-zinc-100">
                    {isListening ? 'Escuchando...' : processing ? 'Procesando...' : 'Presiona para hablar'}
                </h3>
                <p className="text-zinc-400 text-sm">
                    {transcript || "Dí algo como 'Crear nueva propiedad'..."}
                </p>
            </div>

            {processing && (
                <div className="flex items-center gap-2 text-primary-500 text-sm font-medium">
                    <Loader2 size={16} className="animate-spin" /> Analizando comando...
                </div>
            )}

            {feedback && (
                <div className={`p-3 rounded-xl text-sm font-medium w-full ${feedback.startsWith('✅') ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-900/50' : 'bg-zinc-800 text-zinc-300'}`}>
                    {feedback}
                </div>
            )}

            <button
                onClick={isListening ? stopListening : startListening}
                className={`px-8 py-3 rounded-xl font-bold transition-all transform active:scale-95 ${
                    isListening
                    ? 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30'
                    : 'bg-primary-500 text-black hover:bg-primary-400 shadow-lg shadow-primary-500/20'
                }`}
            >
                {isListening ? 'Detener' : 'Iniciar Grabación'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceCommandModal;
