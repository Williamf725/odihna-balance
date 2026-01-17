import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { Property, Reservation, Platform, AppAction } from "../types";

// Helper for generating safe IDs inside the service
const safeId = () => {
     try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {}
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// Helper to get API Key safely
const getApiKey = () => {
    // Vite exposes variables starting with VITE_ on import.meta.env
    return import.meta.env.VITE_API_KEY;
};

// --- Tool Definitions ---

const addPropertyTool: FunctionDeclaration = {
  name: 'addProperty',
  description: 'Add a new property to the database.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: 'Name of the property/accommodation' },
      ownerName: { type: Type.STRING, description: 'Full name of the owner' },
      city: { type: Type.STRING, description: 'City location' },
      commissionRate: { type: Type.NUMBER, description: 'Commission percentage (e.g., 15 or 20)' }
    },
    required: ['name', 'ownerName', 'commissionRate']
  }
};

const updatePropertyTool: FunctionDeclaration = {
  name: 'updateProperty',
  description: 'Update an existing property details, especially commission rate.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: 'The exact ID of the property to update' },
      commissionRate: { type: Type.NUMBER, description: 'The new commission percentage' },
      name: { type: Type.STRING },
      ownerName: { type: Type.STRING }
    },
    required: ['id']
  }
};

const deletePropertyTool: FunctionDeclaration = {
  name: 'deleteProperty',
  description: 'Delete a property from the database using its ID.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: 'The exact ID of the property to delete' }
    },
    required: ['id']
  }
};

const addReservationTool: FunctionDeclaration = {
  name: 'addReservation',
  description: 'Add a new reservation. If it is Airbnb, use usdAmount.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      propertyId: { type: Type.STRING, description: 'The ID of the property for this reservation' },
      guestName: { type: Type.STRING, description: 'Name of the guest' },
      checkInDate: { type: Type.STRING, description: 'YYYY-MM-DD format' },
      checkOutDate: { type: Type.STRING, description: 'YYYY-MM-DD format' },
      totalAmount: { type: Type.NUMBER, description: 'Total amount in COP (for non-Airbnb)' },
      usdAmount: { type: Type.NUMBER, description: 'Amount in USD (only for Airbnb)' },
      platform: { type: Type.STRING, description: 'Airbnb, Booking, Directo, etc.' }
    },
    required: ['propertyId', 'guestName', 'checkInDate', 'checkOutDate']
  }
};

const deleteReservationTool: FunctionDeclaration = {
  name: 'deleteReservation',
  description: 'Delete a reservation using its ID.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING, description: 'The exact ID of the reservation to delete' }
    },
    required: ['id']
  }
};

const updateReservationTool: FunctionDeclaration = {
    name: 'updateReservation',
    description: 'Update an existing reservation.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: 'The ID of the reservation to update' },
            totalAmount: { type: Type.NUMBER, description: 'New total amount in COP' },
            usdAmount: { type: Type.NUMBER, description: 'New USD amount for Airbnb' },
            guestName: { type: Type.STRING },
            notes: { type: Type.STRING }
        },
        required: ['id']
    }
};

/**
 * Chat with the AI using context and Tools.
 */
export const sendChatMessage = async (
  message: string,
  properties: Property[],
  reservations: Reservation[]
): Promise<{ text: string; actions: AppAction[] }> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
        return { text: "Error de Configuración: No se encontró la variable VITE_API_KEY. Por favor agrégala en Vercel.", actions: [] };
    }
    const ai = new GoogleGenAI({ apiKey });

    const context = `
      Eres el asistente virtual inteligente de "Odihna Balance".
      
      PERSONALIDAD:
      - Eres amable, profesional, proactivo y entusiasta.
      - Tu objetivo es ayudar al usuario a gestionar sus alquileres con facilidad.
      - Habla de forma natural, no como un robot.
      
      CONTEXTO TÉCNICO:
      - Moneda: Pesos Colombianos (COP) para reservas directas/Booking.
      - IMPORTANTE: Para reservas de AIRBNB, el usuario prefiere ingresar el monto en DOLARES (USD) si es posible.
      - Fecha actual: ${new Date().toISOString().split('T')[0]}.

      DATOS ACTUALES DEL SISTEMA:
      PROPIEDADES:
      ${JSON.stringify(properties.map(p => ({ id: p.id, name: p.name, owner: p.ownerName, commission: p.commissionRate })))}
      
      RESERVAS:
      ${JSON.stringify(reservations.map(r => ({ 
        id: r.id, 
        propId: r.propertyId, 
        guest: r.guestName, 
        amount: r.totalAmount,
        usd: r.usdAmount,
        dates: `${r.checkInDate} to ${r.checkOutDate}` 
      })))}
      
      INSTRUCCIONES DE INTERACCIÓN:
      1. Si el usuario pide una acción (agregar, borrar, editar), EJECUTA LA HERRAMIENTA correspondiente.
      2. MUY IMPORTANTE: Cuando ejecutes una herramienta, GENERA TAMBIÉN UNA RESPUESTA DE TEXTO AMABLE confirmando la acción verbalmente.
      3. Si es una reserva de Airbnb, prioriza usar el campo usdAmount si el usuario lo menciona en dólares.
    `;

    // Fallback to flash model if pro is unavailable for the key tier, but try Pro first as requested
    const modelId = 'gemini-3-pro-preview';
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        { role: 'user', parts: [{ text: context }] },
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        tools: [{ 
            functionDeclarations: [
                addPropertyTool, 
                updatePropertyTool, 
                deletePropertyTool, 
                addReservationTool, 
                deleteReservationTool,
                updateReservationTool
            ] 
        }],
      }
    });

    const actions: AppAction[] = [];
    
    let responseText = response.text || "";
    const functionCalls = response.functionCalls;

    if (functionCalls) {
        for (const fc of functionCalls) {
            const args = fc.args as any;

            switch (fc.name) {
                case 'addProperty':
                    actions.push({ type: 'ADD_PROPERTY', payload: { ...args, id: safeId() } });
                    break;
                case 'updateProperty':
                    actions.push({ type: 'UPDATE_PROPERTY', payload: args });
                    break;
                case 'deleteProperty':
                    actions.push({ type: 'DELETE_PROPERTY', payload: args });
                    break;
                case 'addReservation':
                    actions.push({ 
                        type: 'ADD_RESERVATION', 
                        payload: { ...args, id: safeId(), platform: args.platform || 'Directo' } 
                    });
                    break;
                case 'deleteReservation':
                    actions.push({ type: 'DELETE_RESERVATION', payload: args });
                    break;
                case 'updateReservation':
                    actions.push({ type: 'UPDATE_RESERVATION', payload: args });
                    break;
            }
        }
    }

    if (!responseText.trim() && actions.length > 0) {
        responseText = "¡Listo! He realizado los cambios correctamente.";
    } else if (!responseText.trim()) {
        responseText = "Lo siento, procesé la información pero no supe qué decir. ¿Podrías intentar de nuevo?";
    }

    return { text: responseText, actions };

  } catch (error: any) {
    // Detailed logging for debugging in browser console
    console.error("Gemini API Error Details:", error);
    
    let userMsg = "Lo siento, tuve problemas para conectar con el servidor de IA.";
    if (error.message?.includes("403")) userMsg += " (Error de Permisos/API Key inválida)";
    if (error.message?.includes("404")) userMsg += " (Modelo no encontrado)";
    if (error.message?.includes("429")) userMsg += " (Límite de cuota excedido)";
    
    return { text: userMsg + " Verifica la consola para más detalles.", actions: [] };
  }
};

/**
 * Parses natural language text into a structured Reservation or Property object.
 */
export const parseVoiceCommand = async (
  text: string, 
  existingProperties: Property[]
): Promise<{ 
  type: 'reservation' | 'property' | 'unknown', 
  data?: any,
  message?: string 
}> => {
  try {
     const apiKey = getApiKey();
     if (!apiKey) {
        return { type: 'unknown', message: "Error: Falta VITE_API_KEY." };
     }
     const ai = new GoogleGenAI({ apiKey });

     const propertyList = existingProperties.map(p => ({
        id: p.id,
        name: p.name,
        owner: p.ownerName
    }));
    
    const prompt = `
      Analiza el siguiente texto: "${text}".
      Moneda: Pesos Colombianos (COP), o Dolares (USD) si es Airbnb.
      Propiedades Existentes: ${JSON.stringify(propertyList)}.
      
      TAREA: Extraer datos para crear una propiedad o una reserva.
      
      Devuelve SOLO un objeto JSON:
      1. Propiedad: { "actionType": "create_property", "propertyData": { "name": "...", "ownerName": "...", "city": "...", "commissionRate": 15 } }
      2. Reserva: { "actionType": "create_reservation", "reservationData": { "propertyId": "ID", "guestName": "...", "totalAmount": 0, "usdAmount": 0, "platform": "Airbnb|Booking|Directo", "checkInDate": "YYYY-MM-DD", "checkOutDate": "YYYY-MM-DD" } }
      
      Si es Airbnb, intenta detectar si el monto es en dólares y ponlo en usdAmount.
    `;

     const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const result = JSON.parse(response.text || '{}');
    
    if (result.actionType === 'create_property') return { type: 'property', data: result.propertyData, message: "Propiedad detectada." };
    if (result.actionType === 'create_reservation') {
        if (!existingProperties.find(p => p.id === result.reservationData.propertyId)) {
             return { type: 'unknown', message: "No encontré la propiedad especificada." };
        }
        return { type: 'reservation', data: result.reservationData, message: "Reserva detectada." };
    }
    
    return { type: 'unknown', message: "No pude entender el comando." };

  } catch (e: any) {
      console.error("Voice Command Error:", e);
      return { type: 'unknown', message: "Error al procesar el texto con la IA." };
  }
};
