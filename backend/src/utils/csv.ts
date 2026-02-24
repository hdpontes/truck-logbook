import { Parser } from 'json2csv';

/**
 * Converte array de objetos para CSV
 */
export function convertToCSV(data: any[], fields?: string[]): string {
  if (!data || data.length === 0) {
    return '';
  }

  try {
    const parser = new Parser({ fields });
    return parser.parse(data);
  } catch (error) {
    console.error('Error converting to CSV:', error);
    throw new Error('Failed to convert data to CSV');
  }
}

/**
 * Parse CSV string para array de objetos
 */
export function parseCSV(csvString: string): any[] {
  const lines = csvString.trim().split('\n');
  
  if (lines.length < 2) {
    return [];
  }

  // Primeira linha são os headers
  const headers = parseCsvLine(lines[0]);
  const result: any[] = [];

  // Processar cada linha de dados
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Pular linhas vazias
    
    const values = parseCsvLine(line);
    const obj: any = {};

    headers.forEach((header, index) => {
      let value = values[index] || '';
      
      // Converter valores
      if (value === 'true') {
        obj[header] = true;
      } else if (value === 'false') {
        obj[header] = false;
      } else if (value === 'null' || value === '') {
        obj[header] = null;
      } else if (!isNaN(Number(value)) && value !== '') {
        obj[header] = Number(value);
      } else {
        obj[header] = value;
      }
    });

    result.push(obj);
  }

  return result;
}

/**
 * Parse uma linha CSV respeitando aspas
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Aspas duplas escapadas
        current += '"';
        i++; // Pular próximo caractere
      } else {
        // Toggle estado de aspas
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Fim do campo
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Adicionar último campo
  result.push(current.trim());

  return result;
}
