import { useState,useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Route, Truck, FileText, Repeat } from 'lucide-react';
import ExpensesCalendarTab from '@/components/ExpensesCalendarTab';
import TripExpensesTab from '@/components/TripExpensesTab';
import TruckExpensesTab from '@/components/TruckExpensesTab';
import OtherExpensesTab from '@/components/OtherExpensesTab';
import RecurringExpensesTab from '@/components/RecurringExpensesTab';

export default function NewExpensesPage() {
  const [activeTab, setActiveTab] = useState('calendar');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Calendário</span>
          </TabsTrigger>
          <TabsTrigger value="trips" className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            <span>Viagens</span>
          </TabsTrigger>
          <TabsTrigger value="trucks" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span>Caminhões</span>
          </TabsTrigger>
          <TabsTrigger value="other" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Outras</span>
          </TabsTrigger>
          <TabsTrigger value="recurring" className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            <span>Recorrentes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <ExpensesCalendarTab />
        </TabsContent>

        <TabsContent value="trips" className="space-y-4">
          <TripExpensesTab />
        </TabsContent>

        <TabsContent value="trucks" className="space-y-4">
          <TruckExpensesTab />
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
          <OtherExpensesTab />
        </TabsContent>

        <TabsContent value="recurring" className="space-y-4">
          <RecurringExpensesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
