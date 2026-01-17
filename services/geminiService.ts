import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { Property, Reservation, Platform, AppAction } from "../types";

const apiKey = 'AIzaSyDV33xUUeJgg_t57690lGoHTTwVDgzzBTo';
const genAI = new GoogleGenerativeAI(apiKey);

// Helper for generating safe IDs inside the service
const safeId = () => {
     try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {}
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// --- Tool Definitions ---

const addPropertyTool: FunctionDeclaration = {
  name: 'addProperty',
  description: 'Add a new property to the database.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      name: { type: SchemaType.STRING, description: 'Name of the property/accommodation' },
      ownerName: { type: SchemaType.STRING, description: 'Full name of the owner' },
      city: { type: SchemaType.STRING, description: 'City location' },
      commissionRate: { type: SchemaType.NUMBER, description: 'Commission percentage (e.g., 15 or 20)' }
    },
    required: ['name', 'ownerName', 'commissionRate']
  }
};

const updatePropertyTool: FunctionDeclaration = {
  name: 'updateProperty',
  description: 'Update an existing property details, especially commission rate.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING, description: 'The exact ID of the property to update' },
      commissionRate: { type: SchemaType.NUMBER, description: 'The new commission percentage' },
      name: { type: SchemaType.STRING },
      ownerName: { type: SchemaType.STRING }
    },
    required: ['id']
  }
};

const deletePropertyTool: FunctionDeclaration = {
  name: 'deleteProperty',
  description: 'Delete a property from the database using its ID.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING, description: 'The exact ID of the property to delete' }
    },
    required: ['id']
  }
};

const addReservationTool: FunctionDeclaration = {
  name: 'addReservation',
  description: 'Add a new reservation. If it is Airbnb, use usdAmount.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      propertyId: { type: SchemaType.STRING, description: 'The ID of the property for this reservation' },
      guestName: { type: SchemaType.STRING, description: 'Name of the guest' },
      checkInDate: { type: SchemaType.STRING, description: 'YYYY-MM-DD format' },
      checkOutDate: { type: SchemaType.STRING, description: 'YYYY-MM-DD format' },
      totalAmount: { type: SchemaType.NUMBER, description: 'Total amount in COP (for non-Airbnb)' },
      usdAmount: { type: SchemaType.NUMBER, description: 'Amount in USD (only for Airbnb)' },
      platform: { type: SchemaType.STRING, description: 'Airbnb, Booking, Directo, etc.' }
    },
    required: ['propertyId', 'guestName', 'checkInDate', 'checkOutDate']
  }
};

const deleteReservationTool: FunctionDeclaration = {
  name: 'deleteReservation',
  description: 'Delete a reservation using its ID.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING, description: 'The exact ID of the reservation to delete' }
    },
    required: ['id']
  }
};

const updateReservationTool: FunctionDeclaration = {
    name: 'updateReservation',
    description: 'Update an existing reservation.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            id: { type: SchemaType.STRING, description: 'The ID of the reservation to update' },
            totalAmount: { type: SchemaType.NUMBER, description: 'New total amount in COP' },
            usdAmount: { type: SchemaType.NUMBER, description: 'New USD amount for Airbnb' },
            guestName: { type: SchemaType.STRING },
            notes: { type: SchemaType.STRING }
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

    // Usar SDK público
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-pro',
      tools: [{ 
        functionDeclarations: [
          addPropertyTool, 
          updatePropertyTool, 
          deletePropertyTool, 
          addReservationTool, 
          deleteReservationTool,
          updateReservationTool
        ] 
      }]
    });

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: context }]
        }
      ]
    });

    const result = await chat.sendMessage(message);
    const response = result.response;

    const actions: AppAction[] = [];
    
    // Obtener function calls usando SDK público
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
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

    // Obtener texto usando SDK público
    let responseText = response.text();

    if (!responseText.trim() && actions.length > 0) {
        responseText = "¡Listo! He realizado los cambios correctamente.";
    } else if (!responseText.trim()) {
        responseText = "Lo siento, procesé la información pero no supe qué decir. ¿Podrías intentar de nuevo?";
    }

    return { text: responseText, actions };

  } catch (error: any) {
    console.error("Error calling Gemini Chat:", error);
    return { text: "Lo siento, tuve problemas para conectar con el servidor de IA.", actions: [] };
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

    // Usar SDK público
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    const resultData = JSON.parse(response.text() || '{}');
    
    if (resultData.actionType === 'create_property') {
      return { type: 'property', data: resultData.propertyData, message: "Propiedad detectada." };
    }
    
    if (resultData.actionType === 'create_reservation') {
        if (!existingProperties.find(p => p.id === resultData.reservationData.propertyId)) {
             return { type: 'unknown', message: "No encontré la propiedad especificada." };
        }
        return { type: 'reservation', data: resultData.reservationData, message: "Reserva detectada." };
    }
    
    return { type: 'unknown', message: "No pude entender el comando." };

  } catch (e: any) {
      return { type: 'unknown', message: "Hubo un error al procesar el texto con la IA." };
  }
};
