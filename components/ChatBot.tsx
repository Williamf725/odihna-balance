import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Bot, Sparkles, MessageSquare } from 'lucide-react';
import { Property, Reservation } from '../types';
import { sendChatMessage } from '../services/geminiService';

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  reservations: Reservation[];
  onAction: (action: any) => void;
}

const ChatBot: React.FC<ChatBotProps> = ({ isOpen, onClose, properties, reservations, onAction }) => {
  const [messages, setMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([
    { role: 'assistant', content: 'Hola, soy tu asistente de Odihna. ¿En qué puedo ayudarte hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
        const result = await sendChatMessage(userMessage, properties, reservations);

        // Execute actions if any
        if (result.actions && result.actions.length > 0) {
            result.actions.forEach(action => {
                onAction(action);
            });
        }

        setMessages(prev => [...prev, { role: 'assistant', content: result.text }]);
    } catch (error) {
        console.error("Chat Error:", error);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, hubo un error al conectar con la IA.' }]);
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 left-4 lg:left-64 z-50 w-80 lg:w-96 bg-zinc-900 rounded-2xl shadow-2xl border border-primary-500/30 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-amber-600 p-4 flex justify-between items-center text-black">
        <div className="flex items-center gap-2">
          <div className="bg-black/20 p-1.5 rounded-lg">
            <Bot size={20} className="text-black" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Asistente Odihna</h3>
            <p className="text-[10px] text-black/70 flex items-center gap-1">
              <Sparkles size={8} /> Powered by Gemini
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-full transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 h-80 overflow-y-auto p-4 space-y-4 bg-zinc-950">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${
              msg.role === 'user' 
                ? 'bg-primary-500 text-black rounded-tr-none font-medium'
                : 'bg-zinc-800 text-zinc-200 rounded-tl-none border border-zinc-700'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none border border-zinc-700 flex gap-1">
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce delay-75" />
              <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce delay-150" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pregunta algo..."
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-zinc-200 placeholder-zinc-500"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-primary-500 text-black rounded-xl hover:bg-primary-400 disabled:opacity-50 transition-colors shadow-lg shadow-primary-900/20"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
