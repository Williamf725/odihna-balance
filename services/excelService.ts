import * as XLSX from 'xlsx';
import { Property, Reservation, Platform } from '../types';
import { generateId } from '../App'; // We reuse the generator or duplicate logic if needed

// --- Helper Types ---
interface ImportResult {
  newProperties: Property[];
  newReservations: Reservation[];
  errors: string[];
  summary: string;
}

// --- Header Mapping (Spanish variations to Internal Keys) ---
const PROPERTY_MAP: Record<string, string[]> = {
  name: ['nombre', 'propiedad', 'alojamiento', 'nombre propiedad', 'name'],
  ownerName: ['dueño', 'propietario', 'owner', 'nombre dueño'],
  city: ['ciudad', 'ubicación', 'city', 'location'],
  commissionRate: ['comisión', 'porcentaje', 'tasa', '%', 'commission']
};

const RESERVATION_MAP: Record<string, string[]> = {
  guestName: ['huesped', 'cliente', 'nombre', 'guest', 'nombre huesped'],
  propertyName: ['propiedad', 'alojamiento', 'casa', 'apto'], // To link with ID
  platform: ['plataforma', 'canal', 'sitio', 'source'],
  checkInDate: ['entrada', 'llegada', 'checkin', 'check-in', 'inicio'],
  checkOutDate: ['salida', 'ida', 'checkout', 'check-out', 'fin'],
  totalAmount: ['total', 'monto', 'precio', 'valor', 'cop'],
  usdAmount: ['usd', 'dolares', 'amount usd']
};

/**
 * Normalizes a header string (e.g., "  Nombre del Dueño " -> "nombredeldueño")
 */
const normalizeHeader = (h: string) => h?.toString().toLowerCase().trim().replace(/_/g, ' ').replace(/\s+/g, '') || '';

/**
 * Tries to find a value in a row based on multiple possible header names.
 */
const findValue = (row: any, normalizedHeaders: Record<string, string>, possibleHeaders: string[]): any => {
  for (const h of possibleHeaders) {
    const normalizedKey = normalizeHeader(h);
    // Find the actual key in the row that matches this normalized key
    const actualKey = Object.keys(row).find(k => normalizeHeader(k).includes(normalizedKey));
    if (actualKey && row[actualKey] !== undefined) return row[actualKey];
  }
  return undefined;
};

/**
 * Helper to parse dates from Excel (which can be numbers or strings)
 */
const parseDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    
    // If it's an Excel serial number
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    
    // If string, try to parse. Assume YYYY-MM-DD or DD/MM/YYYY
    const str = String(val).trim();
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str; // Already correct
    
    // Handle DD/MM/YYYY
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            // Assume Day/Month/Year
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    
    return new Date().toISOString().split('T')[0]; // Fallback
};

/**
 * Main function to process the file
 */
export const processExcelFile = async (
    file: File, 
    existingProperties: Property[]
): Promise<ImportResult> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                if (!jsonData || jsonData.length === 0) {
                    resolve({ newProperties: [], newReservations: [], errors: ["El archivo está vacío."], summary: "" });
                    return;
                }

                const newProperties: Property[] = [];
                const newReservations: Reservation[] = [];
                const errors: string[] = [];
                
                // Determine if we are importing Properties or Reservations based on headers
                const firstRow = jsonData[0] as any;
                const headers = Object.keys(firstRow).map(normalizeHeader);
                
                // Heuristic: If it has "Commission" or "Dueño" AND NOT "CheckIn", it's likely Properties.
                // If it has "CheckIn" or "Entrada", it's likely Reservations.
                const hasCommission = headers.some(h => normalizeHeader('comisión').includes(h) || h.includes('comision') || h.includes('porcentaje'));
                const hasOwner = headers.some(h => normalizeHeader('dueño').includes(h) || h.includes('propietario'));
                const hasCheckIn = headers.some(h => normalizeHeader('entrada').includes(h) || h.includes('checkin') || h.includes('fecha'));

                const isPropertySheet = (hasOwner || hasCommission) && !hasCheckIn;

                if (isPropertySheet) {
                    // PROCESS PROPERTIES
                    jsonData.forEach((row: any, index) => {
                        const name = findValue(row, {}, PROPERTY_MAP.name);
                        const ownerName = findValue(row, {}, PROPERTY_MAP.ownerName);
                        
                        if (name && ownerName) {
                            newProperties.push({
                                id: generateId(),
                                name: String(name).trim(),
                                ownerName: String(ownerName).trim(),
                                city: String(findValue(row, {}, PROPERTY_MAP.city) || 'Desconocida'),
                                commissionRate: Number(findValue(row, {}, PROPERTY_MAP.commissionRate) || 20)
                            });
                        }
                    });
                } else {
                    // PROCESS RESERVATIONS
                    jsonData.forEach((row: any, index) => {
                        const guestName = findValue(row, {}, RESERVATION_MAP.guestName);
                        const propName = findValue(row, {}, RESERVATION_MAP.propertyName);
                        
                        if (guestName) {
                            // Try to link to existing property
                            let propId = "";
                            const cleanPropName = String(propName || "").toLowerCase().trim();
                            
                            // 1. Check in existing properties
                            const existingProp = existingProperties.find(p => p.name.toLowerCase().includes(cleanPropName));
                            if (existingProp) propId = existingProp.id;
                            
                            // 2. If not found, check in NEW properties (if we were doing mixed import, but here we separate logic. 
                            // Ideally, user should import properties first).
                            if (!propId) {
                                // Fallback: Assign to the first property available or flag error?
                                // Let's try to match loosely or default to first if only 1 exists
                                if (existingProperties.length === 1) propId = existingProperties[0].id;
                            }

                            if (!propId && propName) {
                                errors.push(`Fila ${index + 2}: No se encontró la propiedad "${propName}". Importa primero las propiedades.`);
                                return; 
                            } else if (!propId) {
                                errors.push(`Fila ${index + 2}: Falta el nombre de la propiedad.`);
                                return;
                            }

                            const platformStr = String(findValue(row, {}, RESERVATION_MAP.platform) || "Directo").toLowerCase();
                            let platform = Platform.Direct;
                            if (platformStr.includes('airbnb')) platform = Platform.Airbnb;
                            if (platformStr.includes('booking')) platform = Platform.Booking;
                            if (platformStr.includes('otro')) platform = Platform.Other;

                            newReservations.push({
                                id: generateId(),
                                propertyId: propId,
                                guestName: String(guestName),
                                checkInDate: parseDate(findValue(row, {}, RESERVATION_MAP.checkInDate)),
                                checkOutDate: parseDate(findValue(row, {}, RESERVATION_MAP.checkOutDate)),
                                totalAmount: Number(findValue(row, {}, RESERVATION_MAP.totalAmount) || 0),
                                usdAmount: Number(findValue(row, {}, RESERVATION_MAP.usdAmount) || 0),
                                platform: platform
                            });
                        }
                    });
                }

                resolve({
                    newProperties,
                    newReservations,
                    errors,
                    summary: `Se encontraron ${newProperties.length} propiedades y ${newReservations.length} reservas.`
                });

            } catch (err: any) {
                reject("Error al leer el archivo Excel: " + err.message);
            }
        };

        reader.readAsBinaryString(file);
    });
};
