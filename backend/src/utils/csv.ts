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
  const headers = lines[0].split(',').map(h => h.trim());
  const result: any[] = [];

  // Processar cada linha de dados
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const obj: any = {};

    headers.forEach((header, index) => {
      let value = values[index]?.trim() || '';
      
      // Remover aspas se existirem
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

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
