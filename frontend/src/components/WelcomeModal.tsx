import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Props {
  userName?: string;
  role?: string | null;
  onClose: (hideForever: boolean) => void;
}

export default function WelcomeModal({ userName, role, onClose }: Props) {
  const [dontShowAgain, setDontShowAgain] = React.useState(false);

  const renderDriverContent = () => (
    <div className="space-y-3">
      <p className="text-gray-700">Olá{userName ? `, ${userName}` : ''}! Nesta área o motorista pode:</p>
      <ul className="list-disc list-inside text-gray-700">
        <li>Visualizar viagens atribuídas</li>
        <li>Iniciar e finalizar viagens</li>
        <li>Registrar despesas relacionadas à viagem</li>
        <li>Receber mensagens e notificações da operação</li>
        <li>Consultar histórico e detalhes da sua frota</li>
      </ul>
    </div>
  );

  const renderAdminManagerContent = () => (
    <div className="space-y-3">
      <p className="text-gray-700">Bem-vindo{userName ? `, ${userName}` : ''}! Como administrador/gerente você pode:</p>
      <ul className="list-disc list-inside text-gray-700">
        <li>Gerenciar viagens, agendamentos e status</li>
        <li>Gerenciar frota (caminhões e carretas)</li>
        <li>Controlar despesas e visualizar relatórios financeiros</li>
        <li>Enviar mensagens para motoristas e receber respostas</li>
        <li>Configurar usuários e permissões</li>
      </ul>
    </div>
  );

  const renderDefaultContent = () => (
    <div className="space-y-3">
      <p className="text-gray-700">Bem-vindo{userName ? `, ${userName}` : ''}! Aqui você pode explorar a plataforma.</p>
      <ul className="list-disc list-inside text-gray-700">
        <li>Visualizar e acompanhar viagens</li>
        <li>Consultar dados da frota e despesas</li>
      </ul>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle className="text-blue-600">Boas-vindas{userName ? `, ${userName}` : ''}!</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {role === 'DRIVER' ? renderDriverContent() : (role === 'ADMIN' || role === 'MANAGER') ? renderAdminManagerContent() : renderDefaultContent()}

            <div className="flex items-center mt-2">
              <input
                id="welcome-dont-show"
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="welcome-dont-show" className="text-sm text-gray-600">Não mostrar novamente</label>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => onClose(false)}>Fechar</Button>
              <Button onClick={() => onClose(dontShowAgain)} className="bg-blue-600 hover:bg-blue-700 text-white">Continuar</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
