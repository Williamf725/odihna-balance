import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { Property, Reservation, Platform, AppAction, ReservationType } from "../types";

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

// ✅ Helper para obtener TRM actual
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

// ✅ ACTUALIZADA: Incluye reservationType y campos mensuales
const addReservationTool: FunctionDeclaration = {
  name: 'addReservation',
  description: 'Add a new reservation. Can be Standard (with commission) or Monthly (fixed expenses). For Airbnb Standard, include exchangeRate and enteredAs. For Monthly, include monthlyExpensesAndOwnerPay.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      propertyId: { type: SchemaType.STRING, description: 'The ID of the property for this reservation' },
      guestName: { type: SchemaType.STRING, description: 'Name of the guest' },
      checkInDate: { type: SchemaType.STRING, description: 'YYYY-MM-DD format' },
      checkOutDate: { type: SchemaType.STRING, description: 'YYYY-MM-DD format' },
      totalAmount: { type: SchemaType.NUMBER, description: 'Total amount in COP. For Monthly, this is the monthly rent value.' },
      platform: { type: SchemaType.STRING, description: 'Platform: Airbnb, Booking, Directo, or Otro' },
      reservationType: { type: SchemaType.STRING, description: 'Standard or Monthly. Default is Standard.' },
      
      // Campos para Standard Airbnb
      usdAmount: { type: SchemaType.NUMBER, description: 'Amount in USD (only for Airbnb Standard)' },
      exchangeRate: { type: SchemaType.NUMBER, description: 'COP/USD exchange rate (only for Airbnb Standard)' },
      enteredAs: { type: SchemaType.STRING, description: 'COP or USD (only for Airbnb Standard)' },
      
      // Campos para Monthly
      monthlyExpensesAndOwnerPay: { type: SchemaType.NUMBER, description: 'Expenses + owner payment (only for Monthly reservations)' },
      monthsCount: { type: SchemaType.NUMBER, description: 'Number of months (calculated automatically for Monthly)' }
    },
    required: ['propertyId', 'guestName', 'checkInDate', 'checkOutDate', 'platform', 'totalAmount']
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

// ✅ ACTUALIZADA: Incluye campos mensuales
const updateReservationTool: FunctionDeclaration = {
    name: 'updateReservation',
    description: 'Update an existing reservation. Can update amounts, exchange rates, or monthly expenses.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            id: { type: SchemaType.STRING, description: 'The ID of the reservation to update' },
            totalAmount: { type: SchemaType.NUMBER, description: 'New total amount in COP' },
            usdAmount: { type: SchemaType.NUMBER, description: 'New USD amount (for Airbnb)' },
            guestName: { type: SchemaType.STRING, description: 'New guest name' },
            notes: { type: SchemaType.STRING, description: 'Additional notes' },
            exchangeRate: { type: SchemaType.NUMBER, description: 'New exchange rate (for Airbnb)' },
            enteredAs: { type: SchemaType.STRING, description: 'COP or USD' },
            monthlyExpensesAndOwnerPay: { type: SchemaType.NUMBER, description: 'New expenses + owner pay (for Monthly)' }
        },
        required: ['id']
    }
};

const getExchangeRateTool: FunctionDeclaration = {
  name: 'getCurrentExchangeRate',
  description: 'Get the current official TRM (exchange rate COP/USD) from Banco de la República de Colombia.',
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
            text: "Error de Configuración: No se encontró la variable VITE_API_KEY. Por favor agrégala en Vercel.", 
            actions: [] 
        };
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    // ✅ Lista numerada de propiedades y reservas
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
      type: r.reservationType || 'Standard',
      copAmount: r.totalAmount,
      usdAmount: r.usdAmount || null,
      exchangeRate: r.exchangeRate || null,
      monthlyExpenses: r.monthlyExpensesAndOwnerPay || null,
      monthsCount: r.monthsCount || null,
      dates: `${r.checkInDate} to ${r.checkOutDate}`
    }));

   const context = `
  Eres el asistente virtual inteligente de "Odihna Balance".
  
  PERSONALIDAD:
  - Eres amable, profesional, proactivo y entusiasta.
  - Ayudas con gestión de alquileres, cálculos, y consultas generales.
  
  TIPOS DE RESERVAS:
  
  1. RESERVAS ESTÁNDAR (Standard):
     - Por noche/corto plazo
     - Se cobra comisión según el porcentaje de la propiedad
     - Para Airbnb: registra tasa de cambio USD/COP específica
     - Cálculo: Mi ganancia = totalAmount × (commissionRate / 100)
  
  2. RESERVAS MENSUALES (Monthly):
     - Arriendos por uno o más meses
     - NO usan comisión porcentual
     - El usuario ingresa:
       * totalAmount: Valor mensual total de la reserva
       * monthlyExpensesAndOwnerPay: Gastos + lo que paga al dueño
     - Cálculo: Mi ganancia = totalAmount - monthlyExpensesAndOwnerPay
     - Se calcula automáticamente la cantidad de meses entre fechas
  
  CAPACIDADES:
  
  1. GESTIÓN:
     - Identificar por número: "propiedad 1", "reserva 5", "primeras 10"
     - Identificar por nombre: "Casa del Mar"
     - Actualizar cualquier campo (ciudad, comisión, nombre, etc.)
  
  2. CONSULTAS Y CÁLCULOS:
     - Cálculos matemáticos
     - Preguntas de negocios/finanzas
     - Consultar TRM actual (usa getCurrentExchangeRate)
  
  FECHA Y HORA ACTUAL:
  - ${new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
  - ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}

  📋 PROPIEDADES (${properties.length} total):
  ${JSON.stringify(propertiesList, null, 2)}
  
  📅 RESERVAS (${reservations.length} total):
  ${JSON.stringify(reservationsList, null, 2)}
  
  INSTRUCCIONES:
  
  1. Para CREAR/EDITAR reservas mensuales:
     - Usa reservationType: "Monthly"
     - Solicita: totalAmount y monthlyExpensesAndOwnerPay
     - NO uses exchangeRate ni usdAmount (solo para Airbnb Standard)
  
  2. Para CREAR/EDITAR reservas estándar de Airbnb:
     - Usa reservationType: "Standard"
     - Solicita: usdAmount, exchangeRate, enteredAs
  
  3. IDENTIFICACIÓN:
     - "Propiedad 1" → Usa propertiesList[0].id
     - "Reserva mensual 3" → Busca en reservationsList donde type = "Monthly"
  
  4. RESPUESTAS:
     - Confirma acciones verbalmente
     - Para preguntas generales, responde sin usar herramientas
     - Sé específico con números y nombres en tu respuesta
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
          getExchangeRateTool
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
                    let propertyToUpdate: Property | undefined;
                    
                    if (args.id) {
                        propertyToUpdate = properties.find(p => p.id === args.id);
                    } else if (args.number) {
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
                            platform: args.platform || 'Directo',
                            reservationType: args.reservationType || ReservationType.Standard
                        } 
                    });
                    break;
                    
                case 'deleteReservation':
                    actions.push({ type: 'DELETE_RESERVATION', payload: args });
                    break;
                    
                case 'updateReservation':
                    actions.push({ type: 'UPDATE_RESERVATION', payload: args });
                    break;
                    
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

    if (additionalInfo) {
        responseText += additionalInfo;
    }

    return { text: responseText, actions };

  } catch (error: any) {
    console.error("Gemini API Error Details:", error);
    
    let userMsg = "Lo siento, tuve problemas para conectar con el servidor de IA.";
    if (error.message?.includes("403")) {
        userMsg += " (Error de Permisos/API Key inválida)";
    }
    if (error.message?.includes("404")) {
        userMsg += " (Modelo no encontrado)";
    }
    if (error.message?.includes("429")) {
        userMsg += " (Límite de cuota excedido)";
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
      Propiedades Existentes: ${JSON.stringify(propertyList)}.
      
      TAREA: Extraer datos para crear una propiedad o una reserva.
      
      Devuelve SOLO un objeto JSON:
      1. Propiedad: { "actionType": "create_property", "propertyData": { "name": "...", "ownerName": "...", "city": "...", "commissionRate": 15 } }
      2. Reserva Standard: { 
           "actionType": "create_reservation", 
           "reservationData": { 
             "propertyId": "ID", 
             "guestName": "...", 
             "totalAmount": 0, 
             "platform": "Airbnb|Booking|Directo", 
             "checkInDate": "YYYY-MM-DD", 
             "checkOutDate": "YYYY-MM-DD",
             "reservationType": "Standard",
             "usdAmount": 0,
             "exchangeRate": 4200,
             "enteredAs": "USD"
           } 
         }
      3. Reserva Mensual: {
           "actionType": "create_reservation",
           "reservationData": {
             "propertyId": "ID",
             "guestName": "...",
             "totalAmount": 1000000,
             "platform": "Directo",
             "checkInDate": "YYYY-MM-DD",
             "checkOutDate": "YYYY-MM-DD",
             "reservationType": "Monthly",
             "monthlyExpensesAndOwnerPay": 800000
           }
         }
      
      Detecta si es:
      - Mensual: Palabras clave "mensual", "arriendo", "mes", "meses"
      - Airbnb Standard: Menciona USD o dólares
      - Standard normal: Resto de casos
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
