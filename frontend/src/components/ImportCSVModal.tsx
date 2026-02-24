import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Upload, AlertCircle, CheckCircle } from 'lucide-react';

interface ImportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (csvData: string) => Promise<{ success: number; errors: any[] }>;
  title: string;
}

export const ImportCSVModal: React.FC<ImportCSVModalProps> = ({
  isOpen,
  onClose,
  onImport,
  title,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: any[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const csvData = e.target?.result as string;
        try {
          const importResult = await onImport(csvData);
          setResult(importResult);
        } catch (error: any) {
          setResult({
            success: 0,
            errors: [{ error: error.message || 'Erro ao importar arquivo' }],
          });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Erro ao ler arquivo:', error);
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione o arquivo CSV
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Escolher Arquivo
              </Button>
              {file && (
                <span className="text-sm text-gray-600">{file.name}</span>
              )}
            </div>
          </div>

          {/* Import Button */}
          <div className="flex gap-3">
            <Button
              onClick={handleImport}
              disabled={!file || loading}
              className="flex-1"
            >
              {loading ? 'Importando...' : 'Importar CSV'}
            </Button>
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-3 mt-4">
              {result.success > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-800 font-medium">
                      {result.success} registro(s) importado(s) com sucesso!
                    </span>
                  </div>
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span className="text-red-800 font-medium">
                      {result.errors.length} erro(s) encontrado(s):
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {result.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-700 pl-7">
                        • {Object.keys(error)[0]}: {Object.values(error)[0] as string}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
