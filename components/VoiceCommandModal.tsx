import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseVoiceCommand } from '../services/geminiService';
import { Property, Reservation } from '../types';

interface VoiceCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  onAddProperty: (p: Property) => void;
  onAddReservation: (r: Reservation) => void;
}

// Define the interface for the window object to include webkitSpeechRecognition
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

const safeId = () => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {}
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

const VoiceCommandModal: React.FC<VoiceCommandModalProps> = ({ 
  isOpen, onClose, properties, onAddProperty, onAddReservation 
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');
  
  const recognitionRef = useRef<any>(null);
  // Ref to hold the latest transcript to avoid closure staleness during onend/process
  const transcriptRef = useRef('');

  useEffect(() => {
    if (isOpen) {
      resetState();
    } else {
      stopListening();
    }
    // Cleanup on unmount
    return () => stopListening();
  }, [isOpen]);

  const resetState = () => {
    setStatus('idle');
    setTranscript('');
    transcriptRef.current = '';
    setFeedback('');
    setIsListening(false);
  };

  const startListening = () => {
    // 1. Check Browser Support
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const SpeechRecognitionConstructor = SpeechRecognition || webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setStatus('error');
      setFeedback("Tu navegador no soporta reconocimiento de voz. Intenta usar Google Chrome.");
      return;
    }

    // 2. Cleanup previous instances
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Remove listeners to prevent side effects
      recognitionRef.current.abort();
    }

    try {
      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.continuous = false; // We want single command processing

      recognition.onstart = () => {
        setIsListening(true);
        setStatus('listening');
        setFeedback('Escuchando... (Habla claro y fuerte)');
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            // Interim results
            finalTranscript += event.results[i][0].transcript;
          }
        }
        
        // Clean up text
        const cleanText = finalTranscript.trim();
        setTranscript(cleanText);
        transcriptRef.current = cleanText;
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        setIsListening(false);
        
        if (event.error === 'no-speech') {
          setStatus('idle'); // Just reset, don't show red error
          setFeedback('No se detectó voz. Intenta de nuevo.');
        } else if (event.error === 'not-allowed') {
          setStatus('error');
          setFeedback('Permiso de micrófono denegado. Verifica tu configuración.');
        } else if (event.error === 'aborted') {
          // Ignore aborted errors (happens when we stop manually)
        } else {
          setStatus('error');
          setFeedback(`Error: ${event.error}. Intenta de nuevo.`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        // If we have a transcript and we weren't in an error state, process it
        // We check status !== 'error' to avoid processing partial garbage if it crashed
        if (transcriptRef.current && transcriptRef.current.length > 2) {
           processTranscript();
        } else if (status === 'listening') {
           // If we were listening but got no text and no error, reset
           setStatus('idle');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (error) {
      console.error("Start Listening Error:", error);
      setStatus('error');
      setFeedback('No se pudo iniciar el micrófono.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };
  
  const processTranscript = async () => {
      const text = transcriptRef.current;
      if (!text) return;
      
      setStatus('processing');
      setFeedback('Analizando con Gemini...');
      
      // Artificial delay for UX so user sees "Processing"
      await new Promise(r => setTimeout(r, 500));

      try {
        const result = await parseVoiceCommand(text, properties);
        
        if (result.type === 'property') {
            onAddProperty({
                id: safeId(),
                name: result.data.name || 'Nueva Propiedad',
                ownerName: result.data.ownerName || 'Desconocido',
                city: result.data.city || 'Ciudad',
                commissionRate: result.data.commissionRate || 15
            });
            setStatus('success');
            setFeedback(result.message || 'Propiedad agregada correctamente.');
        } else if (result.type === 'reservation') {
            if (!result.data.propertyId) {
                setStatus('error');
                setFeedback(result.message || 'No encontré la propiedad mencionada.');
            } else {
                onAddReservation({
                    id: safeId(),
                    propertyId: result.data.propertyId,
                    guestName: result.data.guestName || 'Huesped',
                    platform: result.data.platform || 'Directo',
                    totalAmount: result.data.totalAmount || 0,
                    checkInDate: result.data.checkInDate || new Date().toISOString().split('T')[0],
                    checkOutDate: result.data.checkOutDate || new Date().toISOString().split('T')[0],
                });
                setStatus('success');
                setFeedback('Reserva guardada correctamente.');
            }
        } else {
            setStatus('error');
            setFeedback(result.message || 'No entendí el comando. Intenta ser más específico.');
        }
      } catch (e) {
        setStatus('error');
        setFeedback('Error al procesar la solicitud con AI.');
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl transform transition-all">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-800">Comando de Voz</h2>
          <p className="text-slate-500 mt-2 text-sm">
            Ej: "Nueva reserva en Villa del Sol para mañana a nombre de Carlos por 500 mil pesos"
          </p>
        </div>

        <div className={`min-h-[140px] bg-slate-50 rounded-2xl p-6 mb-6 flex items-center justify-center text-center transition-colors border-2 ${isListening ? 'border-primary-200 bg-primary-50/30' : 'border-transparent'}`}>
            {transcript ? (
                <p className="text-lg text-slate-800 font-medium leading-relaxed">"{transcript}"</p>
            ) : (
                <div className="flex flex-col items-center gap-2">
                   <p className="text-slate-400 font-medium">Presiona el micrófono</p>
                   <p className="text-slate-300 text-sm">y habla claramente</p>
                </div>
            )}
        </div>

        {feedback && (
            <div className={`mb-6 text-center text-sm font-bold flex items-center justify-center gap-2 ${
                status === 'error' ? 'text-rose-500' : 
                status === 'success' ? 'text-emerald-600' : 
                status === 'processing' ? 'text-purple-600' :
                'text-primary-600'
            }`}>
               {status === 'error' && <AlertCircle size={16} />}
               {status === 'success' && <CheckCircle2 size={16} />}
               {feedback}
            </div>
        )}

        <div className="flex justify-center gap-6 items-center">
            {status === 'processing' ? (
                <div className="h-20 w-20 bg-purple-50 rounded-full flex items-center justify-center border-4 border-purple-100">
                     <Loader2 size={36} className="text-purple-600 animate-spin" />
                </div>
            ) : status === 'success' ? (
                 <button onClick={onClose} className="h-20 w-20 bg-emerald-50 rounded-full flex items-center justify-center hover:bg-emerald-100 transition-all border-4 border-emerald-100 transform hover:scale-105">
                     <CheckCircle2 size={36} className="text-emerald-600" />
                 </button>
            ) : isListening ? (
                <button onClick={stopListening} className="h-20 w-20 bg-rose-50 rounded-full flex items-center justify-center hover:bg-rose-100 transition-all border-4 border-rose-100 animate-pulse group">
                    <Square size={28} className="text-rose-500 fill-current group-hover:scale-90 transition-transform" />
                </button>
            ) : (
                <button onClick={startListening} className="h-20 w-20 bg-primary-600 rounded-full flex items-center justify-center hover:bg-primary-700 transition-all shadow-xl shadow-primary-200 hover:shadow-2xl hover:-translate-y-1">
                    <Mic size={36} className="text-white" />
                </button>
            )}
        </div>
        
        <div className="mt-8 flex justify-center">
             <button 
                onClick={onClose} 
                className="px-6 py-2 rounded-full text-slate-400 text-sm hover:text-slate-600 hover:bg-slate-50 transition-colors font-medium"
             >
                Cancelar
             </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceCommandModal;