import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // 1. Criar usuários
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@truck.com' },
    update: {},
    create: {
      login: 'admin',
      email: 'admin@truck.com',
      password: hashedPassword,
      name: 'Administrador',
      role: 'ADMIN',
    },
  });

  const driver1 = await prisma.user.upsert({
    where: { email: 'joao@truck.com' },
    update: {},
    create: {
      login: 'joao',
      email: 'joao@truck.com',
      password: hashedPassword,
      name: 'João Silva',
      role: 'DRIVER',
    },
  });

  const driver2 = await prisma.user.upsert({
    where: { email: 'maria@truck.com' },
    update: {},
    create: {
      login: 'maria',
      email: 'maria@truck.com',
      password: hashedPassword,
      name: 'Maria Santos',
      role: 'DRIVER',
    },
  });

  console.log('✅ Usuários criados:', { admin, driver1, driver2 });

  // 2. Criar caminhões
  const truck1 = await prisma.truck.upsert({
    where: { plate: 'ABC-1234' },
    update: {},
    create: {
      plate: 'ABC-1234',
      model: 'FH 540',
      brand: 'Volvo',
      year: 2020,
      color: 'Branco',
      capacity: 25,
      avgConsumption: 2.5,
    },
  });

  const truck2 = await prisma.truck.upsert({
    where: { plate: 'DEF-5678' },
    update: {},
    create: {
      plate: 'DEF-5678',
      model: 'Actros 2651',
      brand: 'Mercedes-Benz',
      year: 2019,
      color: 'Prata',
      capacity: 30,
      avgConsumption: 2.3,
    },
  });

  const truck3 = await prisma.truck.upsert({
    where: { plate: 'GHI-9012' },
    update: {},
    create: {
      plate: 'GHI-9012',
      model: 'VM 330',
      brand: 'Volkswagen',
      year: 2021,
      color: 'Azul',
      capacity: 23,
      avgConsumption: 2.8,
    },
  });

  console.log('✅ Caminhões criados:', { truck1, truck2, truck3 });

  // 3. Criar viagens
  const trip1 = await prisma.trip.create({
    data: {
      truckId: truck1.id,
      driverId: driver1.id,
      origin: 'São Paulo - SP',
      destination: 'Rio de Janeiro - RJ',
      startDate: new Date('2026-02-15T08:00:00Z'),
      endDate: new Date('2026-02-16T18:00:00Z'),
      distance: 450,
      revenue: 8000,
      status: 'COMPLETED',
      fuelCost: 1500,
      tollCost: 320,
      otherCosts: 280,
      totalCost: 2100,
      profit: 5900,
      profitMargin: 73.75,
    },
  });

  const trip2 = await prisma.trip.create({
    data: {
      truckId: truck2.id,
      driverId: driver2.id,
      origin: 'Curitiba - PR',
      destination: 'Florianópolis - SC',
      startDate: new Date('2026-02-17T07:00:00Z'),
      endDate: new Date('2026-02-17T19:00:00Z'),
      distance: 300,
      revenue: 5500,
      status: 'COMPLETED',
      fuelCost: 980,
      tollCost: 180,
      otherCosts: 150,
      totalCost: 1310,
      profit: 4190,
      profitMargin: 76.18,
    },
  });

  const trip3 = await prisma.trip.create({
    data: {
      truckId: truck1.id,
      driverId: driver1.id,
      origin: 'Belo Horizonte - MG',
      destination: 'Salvador - BA',
      startDate: new Date('2026-02-19T06:00:00Z'),
      distance: 1200,
      revenue: 15000,
      status: 'IN_PROGRESS',
      totalCost: 0,
      profit: 15000,
      profitMargin: 0,
    },
  });

  console.log('✅ Viagens criadas:', { trip1, trip2, trip3 });

  // 4. Criar despesas
  await prisma.expense.createMany({
    data: [
      {
        truckId: truck1.id,
        tripId: trip1.id,
        type: 'FUEL',
        amount: 1500,
        quantity: 500,
        unitPrice: 3.0,
        description: 'Abastecimento completo',
        supplier: 'Posto BR',
        location: 'São Paulo - SP',
        date: new Date('2026-02-15T09:00:00Z'),
      },
      {
        truckId: truck1.id,
        tripId: trip1.id,
        type: 'TOLL',
        amount: 320,
        description: 'Pedágios da viagem',
        date: new Date('2026-02-15T12:00:00Z'),
      },
      {
        truckId: truck1.id,
        tripId: trip1.id,
        type: 'FOOD',
        amount: 180,
        description: 'Refeições do motorista',
        date: new Date('2026-02-15T13:00:00Z'),
      },
      {
        truckId: truck2.id,
        tripId: trip2.id,
        type: 'FUEL',
        amount: 980,
        quantity: 320,
        unitPrice: 3.06,
        description: 'Abastecimento',
        supplier: 'Posto Shell',
        location: 'Curitiba - PR',
        date: new Date('2026-02-17T08:00:00Z'),
      },
      {
        truckId: truck2.id,
        tripId: trip2.id,
        type: 'TOLL',
        amount: 180,
        description: 'Pedágios',
        date: new Date('2026-02-17T10:00:00Z'),
      },
    ],
  });

  console.log('✅ Despesas criadas');

  // 5. Criar manutenções
  await prisma.maintenance.createMany({
    data: [
      {
        truckId: truck1.id,
        type: 'PREVENTIVE',
        description: 'Revisão dos 50.000 km',
        cost: 2500,
        mileage: 50000,
        scheduledDate: new Date('2026-02-25T09:00:00Z'),
        status: 'SCHEDULED',
        priority: 'MEDIUM',
        supplier: 'Oficina Volvo',
      },
      {
        truckId: truck2.id,
        type: 'OIL_CHANGE',
        description: 'Troca de óleo e filtros',
        cost: 1200,
        mileage: 45000,
        scheduledDate: new Date('2026-02-10T14:00:00Z'),
        completedDate: new Date('2026-02-10T16:30:00Z'),
        status: 'COMPLETED',
        priority: 'MEDIUM',
        supplier: 'Mecânica Central',
      },
      {
        truckId: truck3.id,
        type: 'TIRE_CHANGE',
        description: 'Troca de 4 pneus traseiros',
        cost: 4800,
        scheduledDate: new Date('2026-02-22T08:00:00Z'),
        status: 'PENDING',
        priority: 'HIGH',
        supplier: 'Pneutech',
      },
      {
        truckId: truck1.id,
        type: 'INSPECTION',
        description: 'Inspeção veicular anual',
        cost: 800,
        scheduledDate: new Date('2026-02-05T10:00:00Z'),
        status: 'PENDING',
        priority: 'URGENT',
        notes: 'VENCIDA - Agendar urgentemente',
      },
    ],
  });

  console.log('✅ Manutenções criadas');

  // 6. Criar alguns alertas
  await prisma.alert.createMany({
    data: [
      {
        type: 'MAINTENANCE_DUE',
        title: 'Manutenção Vencida',
        message: `Inspeção veicular do caminhão ${truck1.plate} está vencida há 14 dias`,
        severity: 'CRITICAL',
        entityType: 'truck',
        entityId: truck1.id,
      },
      {
        type: 'HIGH_COST',
        title: 'Despesa Alta Detectada',
        message: `Despesa de manutenção de R$ 4.800 registrada para ${truck3.plate}`,
        severity: 'WARNING',
        entityType: 'expense',
      },
      {
        type: 'TRIP_DELAYED',
        title: 'Viagem em Atraso',
        message: `Viagem ${trip3.id} está com prazo estimado em atraso`,
        severity: 'WARNING',
        entityType: 'trip',
        entityId: trip3.id,
      },
    ],
  });

  console.log('✅ Alertas criados');

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\n📊 Resumo:');
  console.log('- 3 usuários criados');
  console.log('- 3 caminhões cadastrados');
  console.log('- 3 viagens registradas');
  console.log('- 5 despesas lançadas');
  console.log('- 4 manutenções agendadas');
  console.log('- 3 alertas gerados');
  console.log('\n🔑 Credenciais de acesso:');
  console.log('Email: admin@truck.com');
  console.log('Senha: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Erro durante seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
