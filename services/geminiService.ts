import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
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
    try {
        return (import.meta as any).env.VITE_API_KEY;
    } catch (e) {
        console.warn("Error accessing API Key:", e);
        return undefined;
    }
};

// ✅ NUEVO: Helper para obtener TRM actual
const getCurrentExchangeRate = async (): Promise<{ rate: number; source: string; date: string }> => {
  try {
    const response = await fetch(
      'https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciahasta%20DESC'
    );
    if (response.ok) {
      const data = await response.json();
      if (data?.[0]?.valor) {
        return {
          rate: parseFloat(data[0].valor),
          source: 'Banco de la República de Colombia (TRM Oficial)',
          date: data[0].vigenciahasta || new Date().toISOString()
        };
      }
    }
    throw new Error('API failed');
  } catch (e) {
    console.error("Error fetching exchange rate:", e);
    return {
      rate: 4200,
      source: 'Valor por defecto (sin conexión)',
      date: new Date().toISOString()
    };
  }
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

// ✅ ACTUALIZADA: Ahora permite cambiar ciudad
const updatePropertyTool: FunctionDeclaration = {
  name: 'updateProperty',
  description: 'Update an existing property details. Can update commission, name, owner, or city. You can update multiple properties by calling this function multiple times.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      id: { type: SchemaType.STRING, description: 'The exact ID of the property to update' },
      commissionRate: { type: SchemaType.NUMBER, description: 'The new commission percentage' },
      name: { type: SchemaType.STRING, description: 'The new property name' },
      ownerName: { type: SchemaType.STRING, description: 'The new owner name' },
      city: { type: SchemaType.STRING, description: 'The new city location' }
    },
    required: ['id']
  }
};

const deletePropertyTool: FunctionDeclaration = {
  name: 'deleteProperty',
  description: 'Delete a property from the database using its ID or number.',
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
  description: 'Add a new reservation. For Airbnb reservations, include exchangeRate and enteredAs fields to track the conversion rate and currency used.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      propertyId: { type: SchemaType.STRING, description: 'The ID of the property for this reservation' },
      guestName: { type: SchemaType.STRING, description: 'Name of the guest' },
      checkInDate: { type: SchemaType.STRING, description: 'YYYY-MM-DD format' },
      checkOutDate: { type: SchemaType.STRING, description: 'YYYY-MM-DD format' },
      totalAmount: { type: SchemaType.NUMBER, description: 'Total amount in COP. For Airbnb, this is calculated based on USD and exchange rate.' },
      usdAmount: { type: SchemaType.NUMBER, description: 'Amount in USD (only for Airbnb reservations)' },
      platform: { type: SchemaType.STRING, description: 'Platform: Airbnb, Booking, Directo, or Otro' },
      exchangeRate: { type: SchemaType.NUMBER, description: 'COP/USD exchange rate (only for Airbnb). Example: 4280.50 means 1 USD = 4280.50 COP' },
      enteredAs: { type: SchemaType.STRING, description: 'How the amount was entered: "COP" or "USD" (only for Airbnb)' }
    },
    required: ['propertyId', 'guestName', 'checkInDate', 'checkOutDate', 'platform']
  }
};

const deleteReservationTool: FunctionDeclaration = {
  name: 'deleteReservation',
  description: 'Delete a reservation using its ID or number.',
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
    description: 'Update an existing reservation. For Airbnb, you can update exchangeRate and amounts.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            id: { type: SchemaType.STRING, description: 'The ID of the reservation to update' },
            totalAmount: { type: SchemaType.NUMBER, description: 'New total amount in COP' },
            usdAmount: { type: SchemaType.NUMBER, description: 'New USD amount (for Airbnb)' },
            guestName: { type: SchemaType.STRING, description: 'New guest name' },
            notes: { type: SchemaType.STRING, description: 'Additional notes' },
            exchangeRate: { type: SchemaType.NUMBER, description: 'New exchange rate (for Airbnb)' },
            enteredAs: { type: SchemaType.STRING, description: 'Updated entry method: COP or USD (for Airbnb)' }
        },
        required: ['id']
    }
};

// ✅ NUEVO: Herramienta para consultar TRM
const getExchangeRateTool: FunctionDeclaration = {
  name: 'getCurrentExchangeRate',
  description: 'Get the current official TRM (exchange rate COP/USD) from Banco de la República de Colombia. Use this when user asks about current dollar price or exchange rate.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
    required: []
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
        return { 
            text: "Error de Configuración: No se encontró la variable VITE_API_KEY. Por favor agrégala en Vercel en Settings > Environment Variables.", 
            actions: [] 
        };
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    // ✅ MEJORADO: Lista numerada de propiedades y reservas
    const propertiesList = properties.map((p, index) => ({
      number: index + 1,
      id: p.id,
      name: p.name,
      owner: p.ownerName,
      city: p.city,
      commission: p.commissionRate
    }));

    const reservationsList = reservations.map((r, index) => ({
      number: index + 1,
      id: r.id,
      propertyId: r.propertyId,
      guest: r.guestName,
      platform: r.platform,
      copAmount: r.totalAmount,
      usdAmount: r.usdAmount || null,
      exchangeRate: r.exchangeRate || null,
      enteredAs: r.enteredAs || null,
      dates: `${r.checkInDate} to ${r.checkOutDate}`
    }));

   const context = `
  Eres el asistente virtual inteligente de "Odihna Balance".
  
  PERSONALIDAD:
  - Eres amable, profesional, proactivo y entusiasta.
  - Además de ayudar con la gestión de alquileres, puedes:
    * Responder preguntas generales de negocios, finanzas, y matemáticas
    * Hacer cálculos matemáticos
    * Consultar la tasa de cambio oficial actual (TRM)
    * Dar consejos sobre gestión de propiedades
  
  CAPACIDADES:
  
  1. GESTIÓN DE PROPIEDADES Y RESERVAS:
     - Cuando el usuario mencione "propiedad número X" o "las primeras 10", usa el campo "number".
     - Cuando mencione "propiedad [nombre]", busca por el campo "name".
     - Puedes actualizar CUALQUIER campo: nombre, dueño, ciudad, comisión.
     - Para actualizar múltiples propiedades, llama a updateProperty varias veces.
  
  2. CONSULTAS Y CÁLCULOS:
     - Haz cálculos matemáticos cuando te lo pidan.
     - Responde preguntas sobre negocios y finanzas.
     - Si preguntan por el dólar/TRM actual, usa la herramienta getCurrentExchangeRate.
  
  3. LIMITACIONES:
     - NO puedes editar fechas de reservas (solo montos, huésped, notas).
     - NO tienes acceso a clima, noticias recientes, o eventos específicos.
  
  CONTEXTO TÉCNICO:
  - Moneda principal: Pesos Colombianos (COP)
  - Para reservas de AIRBNB: Registra tasa de cambio específica por reserva
  - Fecha actual: ${new Date().toISOString().split('T')[0]}
  - Hora actual: ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}

  📋 PROPIEDADES ACTUALES (${properties.length} total):
  ${JSON.stringify(propertiesList, null, 2)}
  
  📅 RESERVAS ACTUALES (${reservations.length} total):
  ${JSON.stringify(reservationsList, null, 2)}
  
  INSTRUCCIONES IMPORTANTES:
  
  1. IDENTIFICACIÓN DE PROPIEDADES/RESERVAS:
     - "Propiedad 1" o "primera propiedad" → Usa number: 1
     - "Propiedades 5 a 10" → Llama updateProperty 6 veces (numbers 5,6,7,8,9,10)
     - "Primeras 10 propiedades" → Llama updateProperty 10 veces (numbers 1-10)
     - "Propiedad Casa del Mar" → Busca por name: "Casa del Mar"
  
  2. ACTUALIZACIÓN DE CIUDAD:
     - La herramienta updateProperty PUEDE cambiar la ciudad.
     - Para cambiar múltiples propiedades, llama la herramienta varias veces.
  
  3. CONSULTA DE TASA DE CAMBIO:
     - Si preguntan "¿Cuál es el dólar hoy?" → Usa getCurrentExchangeRate
     - Si preguntan por tasa de cambio → Usa getCurrentExchangeRate
  
  4. RESPUESTAS:
     - Para preguntas generales, responde directamente sin usar herramientas.
     - Sé específico y detallado con los números de propiedades/reservas en tu respuesta.
`;

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      tools: [{ 
        functionDeclarations: [
          addPropertyTool, 
          updatePropertyTool, 
          deletePropertyTool, 
          addReservationTool, 
          deleteReservationTool,
          updateReservationTool,
          getExchangeRateTool  // ✅ NUEVO
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
    let additionalInfo = '';
    
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
        for (const fc of functionCalls) {
            const args = fc.args as any;

            switch (fc.name) {
                case 'addProperty':
                    actions.push({ type: 'ADD_PROPERTY', payload: { ...args, id: safeId() } });
                    break;
                    
                case 'updateProperty':
                    // ✅ Buscar por número o por ID
                    let propertyToUpdate: Property | undefined;
                    
                    if (args.id) {
                        // Si viene un ID directo
                        propertyToUpdate = properties.find(p => p.id === args.id);
                    } else if (args.number) {
                        // Si viene un número
                        const index = parseInt(args.number) - 1;
                        propertyToUpdate = properties[index];
                    }
                    
                    if (propertyToUpdate) {
                        actions.push({ 
                            type: 'UPDATE_PROPERTY', 
                            payload: { 
                                id: propertyToUpdate.id,
                                ...args 
                            } 
                        });
                    }
                    break;
                    
                case 'deleteProperty':
                    actions.push({ type: 'DELETE_PROPERTY', payload: args });
                    break;
                    
                case 'addReservation':
                    actions.push({ 
                        type: 'ADD_RESERVATION', 
                        payload: { 
                            ...args, 
                            id: safeId(), 
                            platform: args.platform || 'Directo'
                        } 
                    });
                    break;
                    
                case 'deleteReservation':
                    actions.push({ type: 'DELETE_RESERVATION', payload: args });
                    break;
                    
                case 'updateReservation':
                    actions.push({ type: 'UPDATE_RESERVATION', payload: args });
                    break;
                    
                // ✅ NUEVO: Consultar TRM
                case 'getCurrentExchangeRate':
                    const rateInfo = await getCurrentExchangeRate();
                    additionalInfo = `\n\n💵 **Tasa de Cambio Actual (TRM):**\n` +
                                   `- **${rateInfo.rate.toFixed(2)} COP/USD**\n` +
                                   `- Fuente: ${rateInfo.source}\n` +
                                   `- Fecha: ${new Date(rateInfo.date).toLocaleDateString('es-CO')}`;
                    break;
            }
        }
    }

    let responseText = response.text();

    if (!responseText.trim() && actions.length > 0) {
        responseText = "¡Listo! He realizado los cambios correctamente.";
    } else if (!responseText.trim()) {
        responseText = "Lo siento, procesé la información pero no supe qué decir. ¿Podrías intentar de nuevo?";
    }

    // ✅ Agregar info adicional (como TRM)
    if (additionalInfo) {
        responseText += additionalInfo;
    }

    return { text: responseText, actions };

  } catch (error: any) {
    console.error("Gemini API Error Details:", error);
    
    let userMsg = "Lo siento, tuve problemas para conectar con el servidor de IA.";
    if (error.message?.includes("403")) {
        userMsg += " (Error de Permisos/API Key inválida - verifica que VITE_API_KEY esté configurada en Vercel)";
    }
    if (error.message?.includes("404")) {
        userMsg += " (Modelo no encontrado - el modelo gemini-2.5-flash debería estar disponible. Verifica tu API key)";
    }
    if (error.message?.includes("429")) {
        userMsg += " (Límite de cuota excedido - espera un momento antes de reintentar)";
    }
    
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
     const genAI = new GoogleGenerativeAI(apiKey);

     const propertyList = existingProperties.map((p, index) => ({
        number: index + 1,
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
      2. Reserva: { 
           "actionType": "create_reservation", 
           "reservationData": { 
             "propertyId": "ID", 
             "guestName": "...", 
             "totalAmount": 0, 
             "usdAmount": 0, 
             "platform": "Airbnb|Booking|Directo", 
             "checkInDate": "YYYY-MM-DD", 
             "checkOutDate": "YYYY-MM-DD",
             "exchangeRate": 4200,
             "enteredAs": "USD"
           } 
         }
      
      Si es Airbnb, intenta detectar:
      - La tasa de cambio (exchangeRate) si se menciona
      - Si el monto está en USD o COP (enteredAs)
      - Ambos valores (totalAmount y usdAmount) calculados según la tasa
    `;

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
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
      console.error("Voice Command Error:", e);
      return { type: 'unknown', message: "Error al procesar el texto con la IA." };
  }
};
