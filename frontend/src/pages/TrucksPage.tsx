import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { trucksAPI } from '@/lib/api';
import { Truck, Plus, Edit, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Truck {
  id: string;
  plateNumber: string;
  model: string;
  year: number;
  capacity: number;
  fuelType: string;
  currentMileage: number;
  status: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
}

const TrucksPage: React.FC = () => {
  const navigate = useNavigate();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  // Removed showAddModal as it's not used

  useEffect(() => {
    fetchTrucks();
  }, []);

  const fetchTrucks = async () => {
    try {
      setLoading(true);
      const data = await trucksAPI.getAll();
      setTrucks(data);
    } catch (error) {
      console.error('Error fetching trucks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this truck?')) {
      try {
        await trucksAPI.delete(id);
        setTrucks(trucks.filter(truck => truck.id !== id));
      } catch (error) {
        console.error('Error deleting truck:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Fleet Management</h1>
        <Button onClick={() => navigate('/trucks/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Add Truck
        </Button>
      </div>

      {trucks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Truck className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No trucks</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding your first truck to the fleet.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate('/trucks/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Add Truck
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {trucks.map((truck) => (
            <Card key={truck.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{truck.plateNumber}</span>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/trucks/${truck.id}/edit`)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(truck.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-lg font-medium">{truck.model}</p>
                    <p className="text-sm text-gray-500">Year: {truck.year}</p>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="mr-1 h-4 w-4" />
                    {truck.currentMileage.toLocaleString()} km
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        truck.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : truck.status === 'maintenance'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {truck.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      {truck.capacity}t capacity
                    </span>
                  </div>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate(`/trucks/${truck.id}`)}
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrucksPage;
