import { Property, Reservation, CloudConfig, OwnerPayment } from "../types";

const MOCK_DELAY = 2000; // 2 seconds to simulate network
const MOCK_STORAGE_KEY = 'odihna_balance_cloud_mock';

interface BackupData {
    properties: Property[];
    reservations: Reservation[];
    payments: OwnerPayment[];
    timestamp: string;
    version: string;
}

/**
 * Uploads data to the cloud (JSONBin.io) or simulates it if not configured.
 */
export const uploadToCloud = async (
    config: CloudConfig,
    data: { properties: Property[], reservations: Reservation[], payments?: OwnerPayment[] }
): Promise<{ success: boolean; timestamp: string; message?: string }> => {
    
    // Safety: Ensure we never send undefined/null, always arrays
    const payload: BackupData = {
        properties: Array.isArray(data.properties) ? data.properties : [],
        reservations: Array.isArray(data.reservations) ? data.reservations : [],
        payments: Array.isArray(data.payments) ? data.payments : [],
        timestamp: new Date().toISOString(),
        version: "1.1" // Bumped version for payments support
    };

    // 1. Simulation Mode (Default)
    if (!config.enabled || !config.apiKey || !config.binId) {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(payload));
                    resolve({ 
                        success: true, 
                        timestamp: payload.timestamp,
                        message: "Datos guardados en Nube Simulada (Local)." 
                    });
                } catch (e) {
                    resolve({ success: false, timestamp: '', message: "Error al guardar en simulador." });
                }
            }, MOCK_DELAY);
        });
    }

    // 2. Real Cloud Mode (JSONBin.io)
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${config.binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': config.apiKey,
                'X-Bin-Versioning': 'false' // Prevent creating infinite versions to save space/confusion
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return { 
            success: true, 
            timestamp: payload.timestamp,
            message: "¡Sincronización exitosa con la nube real!" 
        };

    } catch (error: any) {
        console.error("Cloud Upload Error:", error);
        return { 
            success: false, 
            timestamp: '', 
            message: error.message || "Error de conexión con la nube." 
        };
    }
};

/**
 * Downloads data from the cloud (JSONBin.io) or the simulation storage.
 */
export const downloadFromCloud = async (
    config: CloudConfig
): Promise<{ success: boolean; data?: BackupData; message?: string }> => {

    // 1. Simulation Mode
    if (!config.enabled || !config.apiKey || !config.binId) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const stored = localStorage.getItem(MOCK_STORAGE_KEY);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored);
                        resolve({ success: true, data: parsed });
                    } catch (e) {
                        resolve({ success: false, message: "Error al leer datos simulados." });
                    }
                } else {
                    resolve({ success: false, message: "No hay copias de seguridad en la nube simulada." });
                }
            }, MOCK_DELAY);
        });
    }

    // 2. Real Cloud Mode
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${config.binId}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': config.apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        
        // JSONBin v3 returns data inside a "record" object usually, but let's be robust
        let rawData = json.record || json;

        // Validation: Construct a valid BackupData object even if fields are missing
        const validatedData: BackupData = {
            properties: Array.isArray(rawData.properties) ? rawData.properties : [],
            reservations: Array.isArray(rawData.reservations) ? rawData.reservations : [],
            payments: Array.isArray(rawData.payments) ? rawData.payments : [],
            timestamp: rawData.timestamp || new Date().toISOString(),
            version: rawData.version || "1.0"
        };

        return { success: true, data: validatedData };

    } catch (error: any) {
        console.error("Cloud Download Error:", error);
        return { success: false, message: error.message || "Error al descargar de la nube." };
    }
};
