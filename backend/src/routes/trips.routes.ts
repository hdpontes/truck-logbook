import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { sendWebhook } from '../utils/webhook';
import { config } from '../config';
import { logAction, LogAction, LogEntity } from '../utils/logger';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/trips - Listar todas as viagens
router.get('/', async (req, res) => {
  try {
    const { status, truckId, driverId, clientId, startDate, endDate } = req.query;

    const trips = await prisma.trip.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(truckId && { truckId: truckId as string }),
        ...(driverId && { driverId: driverId as string }),
        ...(clientId && { clientId: clientId as string }),
        ...(startDate && {
          startDate: {
            gte: new Date(startDate as string),
          },
        }),
        ...(endDate && {
          startDate: {
            lte: new Date(endDate as string),
          },
        }),
      },
      include: {
        truck: {
          select: { id: true, plate: true, model: true, brand: true },
        },
        trailer: {
          select: { id: true, plate: true, model: true, brand: true },
        },
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: {
          select: { id: true, name: true, cnpj: true, city: true, state: true },
        },
        legs: {
          select: { id: true, status: true, type: true, waitingType: true },
          orderBy: { legNumber: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    res.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/trips/truck/:truckId - Obter viagens de um caminhão
router.get('/truck/:truckId', async (req, res) => {
  try {
    const { truckId } = req.params;

    const trips = await prisma.trip.findMany({
      where: { truckId },
      include: {
        trailer: {
          select: { id: true, plate: true, model: true, brand: true },
        },
        driver: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    res.json(trips);
  } catch (error) {
    console.error('Error fetching trips:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/trips/:id - Obter detalhes de uma viagem
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        trailer: true,
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: {
          select: { id: true, name: true, cnpj: true, phone: true, email: true, city: true, state: true },
        },
        expenses: true,
        legs: {
          orderBy: { legNumber: 'asc' },
          include: {
            driver: { select: { id: true, name: true } },
            trailer: { select: { id: true, plate: true } },
          },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Calcular tempos dos trechos
    let timeInTransit = 0; // Tempo em trânsito (trechos NORMAL)
    let timeLoading = 0;    // Tempo carregando
    let timeUnloading = 0;  // Tempo descarregando
    let totalDistance = 0;  // Distância total percorrida

    for (const leg of trip.legs) {
      if (leg.startTime) {
        const endTime = leg.endTime || new Date();
        const duration = endTime.getTime() - leg.startTime.getTime();
        
        if (leg.type === 'NORMAL' || leg.type === 'REPOSICIONAMENTO') {
          timeInTransit += duration;
        } else if (leg.type === 'AGUARDANDO') {
          if (leg.waitingType === 'LOADING') {
            timeLoading += duration;
          } else if (leg.waitingType === 'UNLOADING') {
            timeUnloading += duration;
          }
        }
      }

      // Somar distâncias dos trechos completados
      if (leg.status === 'COMPLETED' && leg.distance) {
        totalDistance += leg.distance;
      }
    }

    // Converter milissegundos para horas e minutos
    const msToHoursMinutes = (ms: number) => {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return { hours, minutes };
    };

    const tripWithCalculations = {
      ...trip,
      calculations: {
        timeInTransit: msToHoursMinutes(timeInTransit),
        timeLoading: msToHoursMinutes(timeLoading),
        timeUnloading: msToHoursMinutes(timeUnloading),
        totalDistance,
        timeInTransitMs: timeInTransit,
        timeLoadingMs: timeLoading,
        timeUnloadingMs: timeUnloading,
      },
    };

    res.json(tripWithCalculations);
  } catch (error) {
    console.error('Error fetching trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips - Criar nova viagem (agendar)
router.post('/', async (req, res) => {
  try {
    const { 
      truckId, 
      trailerId, 
      driverId, 
      clientId, 
      tripCode, 
      origin, 
      destination, 
      startDate, 
      endDate,
      distance, 
      revenue, 
      notes,
      status,
      isRetroactive 
    } = req.body;

    if (!truckId || !driverId || !origin || !destination || !startDate) {
      return res.status(400).json({ 
        message: 'TruckId, driverId, origin, destination and startDate are required' 
      });
    }

    // Validação 1: Não permitir data retroativa (exceto se for viagem retroativa explícita)
    const tripStartDate = new Date(startDate);
    const now = new Date();
    
    // Comparar timestamps diretos (ambos em UTC)
    // Permitir se isRetroactive for true (viagem retroativa intencional)
    if (!isRetroactive && tripStartDate.getTime() < now.getTime()) {
      return res.status(400).json({ 
        message: 'Não é permitido cadastrar viagens com data/hora retroativa' 
      });
    }

    // Verificar se o caminhão existe
    const truck = await prisma.truck.findUnique({
      where: { id: truckId },
    });

    if (!truck) {
      return res.status(404).json({ message: 'Truck not found' });
    }

    // Verificar se o motorista existe
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    // Verificar se a carreta existe (se fornecida)
    let trailer = null;
    if (trailerId) {
      trailer = await prisma.trailer.findUnique({
        where: { id: trailerId },
      });

      if (!trailer) {
        return res.status(404).json({ message: 'Trailer not found' });
      }
    }

    // Verificar se o cliente existe (opcional para viagens retroativas)
    let client = null;
    if (clientId) {
      client = await prisma.client.findUnique({
        where: { id: clientId },
      });

      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
    }

    const trip = await prisma.trip.create({
      data: {
        truckId,
        trailerId: trailerId || null,
        driverId,
        clientId: clientId || null,
        tripCode: tripCode || null,
        origin,
        destination,
        startDate: tripStartDate,
        endDate: endDate ? new Date(endDate) : null,
        distance: distance ? parseFloat(distance) : 0,
        revenue: revenue ? parseFloat(revenue) : 0,
        notes,
        status: status || 'PLANNED',
      },
      include: {
        truck: true,
        trailer: true,
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: {
          select: { id: true, name: true, cnpj: true },
        },
      },
    });

    // Para viagens retroativas, calcular e criar automaticamente despesa de combustível
    if (isRetroactive && distance && parseFloat(distance) > 0 && truck.avgConsumption && truck.avgConsumption > 0) {
      // Buscar preço do diesel nas configurações
      const settings = await prisma.settings.findFirst();
      const dieselPrice = settings?.dieselPrice || 0;
      
      if (dieselPrice > 0) {
        // Calcular litros consumidos = distância / km por litro
        const litersConsumed = parseFloat(distance) / truck.avgConsumption;
        // Calcular custo estimado
        const estimatedFuelCost = litersConsumed * dieselPrice;
        
        // Criar data às 12:00 (meio-dia) para evitar problemas de timezone
        const startDate = new Date(trip.startDate);
        const expenseDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          12, 0, 0, 0
        );
        
        // Criar despesa de combustível automaticamente
        await prisma.expense.create({
          data: {
            truckId: trip.truckId,
            tripId: trip.id,
            type: 'FUEL',
            description: `Combustível calculado automaticamente (${litersConsumed.toFixed(2)}L)`,
            amount: estimatedFuelCost,
            date: expenseDate,
            isPaid: true, // Viagens retroativas já aconteceram, despesa já foi paga
          },
        });

        // Atualizar viagem com o custo de combustível
        await prisma.trip.update({
          where: { id: trip.id },
          data: {
            fuelCost: estimatedFuelCost,
            totalCost: estimatedFuelCost,
            profit: trip.revenue - estimatedFuelCost,
            profitMargin: trip.revenue > 0 ? ((trip.revenue - estimatedFuelCost) / trip.revenue) * 100 : 0,
          },
        });
      }
    }

    // Enviar webhook de corrida agendada (apenas para viagens não retroativas)
    if (!isRetroactive) {
      await sendWebhook('trip.scheduled', {
        trip: {
          id: trip.id,
          tripCode: trip.tripCode,
          origin: trip.origin,
          destination: trip.destination,
          startDate: trip.startDate,
          revenue: trip.revenue,
        },
        truck: {
          id: truck.id,
          plate: truck.plate,
          model: truck.model,
          brand: truck.brand,
        },
        trailer: trailer ? {
          id: trailer.id,
          plate: trailer.plate,
          model: trailer.model,
          brand: trailer.brand,
        } : null,
        driver: {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
        },
        client: trip.client ? {
          clientId: trip.client.id,
          name: trip.client.name,
          cnpj: trip.client.cnpj?.replace(/\D/g, '') || null,
        } : null,
      });
    }

    res.status(201).json(trip);
  } catch (error) {
    console.error('Error creating trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/:id/start - Iniciar uma viagem
router.post('/:id/start', async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        trailer: true,
        driver: true,
        legs: {
          where: { status: { in: ['IN_PROGRESS', 'PAUSED'] } },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Verificar se a viagem tem caminhão e motorista atribuídos
    if (!trip.truck || !trip.driver) {
      return res.status(400).json({ 
        message: 'A viagem deve ter caminhão e motorista atribuídos antes de iniciar' 
      });
    }

    // Verificar se o caminhão já tem uma viagem ativa (trecho IN_PROGRESS)
    const otherInProgressLeg = await prisma.tripLeg.findFirst({
      where: {
        truckId: trip.truckId!,
        status: 'IN_PROGRESS',
        tripId: { not: trip.id },
      },
      include: { trip: true },
    });

    if (otherInProgressLeg) {
      const otherTrip = otherInProgressLeg.trip;
      return res.status(400).json({
        message: `Este caminhão já está em viagem (${otherTrip.origin} → ${otherTrip.destination})`,
      });
    }

    // Verificar se existe uma viagem pausada aguardando descarregamento (UNLOADING)
    const otherPausedUnloadingLeg = await prisma.tripLeg.findFirst({
      where: {
        truckId: trip.truckId!,
        status: 'PAUSED',
        waitingType: 'UNLOADING',
        tripId: { not: trip.id },
      },
      include: { trip: true },
    });

    // Se existir uma viagem pausada por descarregamento:
    if (otherPausedUnloadingLeg) {
      // Se o caminhão for sem capacidade (noCapacity), permitimos iniciar nova viagem (será criado reposicionamento sem carreta)
      if (!trip.truck.noCapacity) {
        const otherTrip = otherPausedUnloadingLeg.trip;
        return res.status(400).json({
          message: `O caminhão desta viagem (${trip.truck.plate}) tem a carreta acoplada e existe uma viagem em andamento (${otherTrip.origin} → ${otherTrip.destination}). Conclua essa viagem antes de iniciar uma nova.`,
        });
      }
      // Caso seja sem capacidade, haverá reposicionamento a partir do trecho pausado (lógica abaixo usa pausedLeg)
      // Vamos buscar o pausedLeg para usar no reposicionamento
      // (usado abaixo na criação do trecho de reposicionamento)
      // Reuse otherPausedUnloadingLeg as paused source
      // We'll set a variable that the code below will pick up if needed
    }

    if (trip.status !== 'PLANNED' && trip.status !== 'DELAYED') {
      // Se já está IN_PROGRESS, verificar se tem trechos pausados
      if (trip.status === 'IN_PROGRESS') {
        const pausedLeg = trip.legs.find(leg => leg.status === 'PAUSED');
        if (pausedLeg) {
          // Retomar viagem pausada - não criar novo trecho, apenas reativar
          return res.status(400).json({ 
            message: 'Esta viagem já está em andamento. Use a rota de retomar viagem' 
          });
        }
      }
      return res.status(400).json({ 
        message: 'Only planned or delayed trips can be started' 
      });
    }

    // Pegar quilometragem atual do caminhão
    const startMileage = trip.truck.currentMileage || 0;

    // Verificar se precisa criar trecho de reposicionamento (existe outra viagem pausada por descarregamento)
    const needsRepositioning = !!otherPausedUnloadingLeg;
    let legNumber = 1;
    let actualStartMileage = startMileage;

    const transactionOperations: any[] = [];

    // Se precisa de reposicionamento, criar trecho 0
    if (needsRepositioning) {
      const pausedLeg = await prisma.tripLeg.findFirst({
        where: {
          tripId: otherPausedUnloadingLeg!.tripId,
          status: 'PAUSED',
        },
        orderBy: { legNumber: 'desc' },
      });

      if (pausedLeg) {
        // Criar trecho de reposicionamento (volta sem carreto)
        transactionOperations.push(
          prisma.tripLeg.create({
            data: {
              tripId: trip.id,
              legNumber: 0,
              type: 'REPOSICIONAMENTO',
              origin: pausedLeg.destination || pausedLeg.origin,
              destination: trip.origin,
              truckId: trip.truckId!,
              trailerId: null, // Sem carreto no reposicionamento
              driverId: trip.driverId!,
              startMileage: pausedLeg.endMileage || startMileage,
              status: 'IN_PROGRESS',
              startTime: new Date(),
            },
          })
        );
        
        actualStartMileage = pausedLeg.endMileage || startMileage;
        legNumber = 1;
      }
    }

    // Criar primeiro trecho normal da viagem
    transactionOperations.push(
      prisma.tripLeg.create({
        data: {
          tripId: trip.id,
          legNumber,
          type: 'NORMAL',
          origin: trip.origin,
          destination: trip.destination,
          truckId: trip.truckId!,
          trailerId: trip.trailerId,
          driverId: trip.driverId!,
          startMileage: actualStartMileage,
          status: needsRepositioning ? 'PAUSED' : 'IN_PROGRESS', // Se há reposicionamento, pausar até completar
          startTime: new Date(),
        },
      })
    );

    // Atualizar trip e status do caminhão
    transactionOperations.push(
      prisma.trip.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          startDate: new Date(),
          startMileage: actualStartMileage,
        },
      })
    );

    transactionOperations.push(
      prisma.truck.update({
        where: { id: trip.truckId! },
        data: { status: 'IN_TRANSIT' },
      })
    );

    await prisma.$transaction(transactionOperations);

    // Buscar viagem atualizada com todas as informações
    const updatedTrip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        trailer: true,
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: true,
        legs: {
          orderBy: { legNumber: 'asc' },
          include: {
            driver: { select: { id: true, name: true } },
            trailer: true,
          },
        },
      },
    });

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error starting trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/trips/:id/legs - Listar trechos de uma viagem
router.get('/:id/legs', async (req, res) => {
  try {
    const { id } = req.params;

    const legs = await prisma.tripLeg.findMany({
      where: { tripId: id },
      orderBy: { legNumber: 'asc' },
      include: {
        driver: {
          select: { id: true, name: true },
        },
        trailer: {
          select: { id: true, plate: true },
        },
      },
    });

    res.json(legs);
  } catch (error) {
    console.error('Error fetching trip legs:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/:id/legs/:legId/finish - Finalizar trecho
router.post('/:id/legs/:legId/finish', async (req, res) => {
  try {
    const { id, legId } = req.params;
    const { endMileage, fuelCost, tollCost, otherCosts, notes } = req.body;

    const leg = await prisma.tripLeg.findUnique({
      where: { id: legId },
      include: { trip: true, truck: true },
    });

    if (!leg) {
      return res.status(404).json({ message: 'Trip leg not found' });
    }

    if (leg.tripId !== id) {
      return res.status(400).json({ message: 'Leg does not belong to this trip' });
    }

    if (leg.status === 'COMPLETED') {
      return res.status(400).json({ message: 'This leg is already completed' });
    }

    const finalEndMileage = parseFloat(endMileage);
    const distance = finalEndMileage - leg.startMileage;

    if (distance < 0) {
      return res.status(400).json({ 
        message: 'A quilometragem final deve ser maior que a inicial' 
      });
    }

    const finalFuelCost = fuelCost ? parseFloat(fuelCost) : 0;
    const finalTollCost = tollCost ? parseFloat(tollCost) : 0;
    const finalOtherCosts = otherCosts ? parseFloat(otherCosts) : 0;
    const totalCost = finalFuelCost + finalTollCost + finalOtherCosts;

    // Atualizar trecho e quilometragem do caminhão
    const [updatedLeg] = await prisma.$transaction([
      prisma.tripLeg.update({
        where: { id: legId },
        data: {
          endMileage: finalEndMileage,
          distance,
          endTime: new Date(),
          status: 'COMPLETED',
          fuelCost: finalFuelCost,
          tollCost: finalTollCost,
          otherCosts: finalOtherCosts,
          totalCost,
          notes,
        },
        include: {
          driver: { select: { id: true, name: true } },
          trailer: { select: { id: true, plate: true } },
        },
      }),
      prisma.truck.update({
        where: { id: leg.truckId },
        data: { currentMileage: finalEndMileage },
      }),
    ]);

    res.json(updatedLeg);
  } catch (error) {
    console.error('Error finishing trip leg:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/:id/pause - Pausar viagem (deixar carreto carregando ou descarregando)
router.post('/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;
    const { currentMileage, location, waitingType } = req.body;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        legs: {
          where: { status: 'IN_PROGRESS' },
          orderBy: { legNumber: 'desc' },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.status !== 'IN_PROGRESS') {
      return res.status(400).json({ 
        message: 'Only in progress trips can be paused' 
      });
    }

    const activeLeg = trip.legs[0];
    if (!activeLeg) {
      return res.status(400).json({ message: 'No active leg found' });
    }

    const finalMileage = parseFloat(currentMileage);
    const distance = finalMileage - activeLeg.startMileage;

    if (distance < 0) {
      return res.status(400).json({ 
        message: 'A quilometragem atual deve ser maior que a inicial' 
      });
    }

    // Validar tipo de espera
    const validWaitingType = waitingType || 'LOADING';
    if (!['LOADING', 'UNLOADING'].includes(validWaitingType)) {
      return res.status(400).json({ 
        message: 'Tipo de espera inválido. Use LOADING ou UNLOADING' 
      });
    }

    const waitingDescription = validWaitingType === 'LOADING' 
      ? 'Aguardando carregamento do carreto'
      : 'Aguardando descarregamento do carreto';

    // Verificar se o leg ativo é um reposicionamento
    const isRepositioning = activeLeg.type === 'REPOSICIONAMENTO';
    let nextLegNumber = activeLeg.legNumber + 1;

    // Se está finalizando um reposicionamento, ativar o próximo leg (que deve estar PAUSED)
    if (isRepositioning) {
      const pausedNextLeg = await prisma.tripLeg.findFirst({
        where: {
          tripId: trip.id,
          legNumber: nextLegNumber,
          status: 'PAUSED',
        },
      });

      if (pausedNextLeg) {
        // Ativar o leg que estava pausado esperando o reposicionamento
        await prisma.tripLeg.update({
          where: { id: pausedNextLeg.id },
          data: {
            status: 'IN_PROGRESS',
            startMileage: finalMileage, // Atualizar km de início
          },
        });
        
        // O próximo leg de aguardamento será criado após este leg ativado
        nextLegNumber = pausedNextLeg.legNumber + 1;
      }
    }

    // Finalizar trecho atual e criar trecho de aguardamento
    const transactionOperations: any[] = [
      // Finalizar trecho atual
      prisma.tripLeg.update({
        where: { id: activeLeg.id },
        data: {
          endMileage: finalMileage,
          distance,
          endTime: new Date(),
          status: 'COMPLETED',
          destination: location || activeLeg.destination,
        },
      }),
      // Criar trecho de aguardamento
      prisma.tripLeg.create({
        data: {
          tripId: trip.id,
          legNumber: nextLegNumber,
          type: 'AGUARDANDO',
          origin: location || activeLeg.destination || activeLeg.origin,
          truckId: activeLeg.truckId,
          trailerId: activeLeg.trailerId,
          driverId: activeLeg.driverId,
          startMileage: finalMileage,
          status: 'PAUSED',
          waitingType: validWaitingType,
          startTime: new Date(),
          notes: waitingDescription,
        },
      }),
      // Atualizar quilometragem do caminhão
      prisma.truck.update({
        where: { id: activeLeg.truckId },
        data: { currentMileage: finalMileage },
      }),
    ];

    await prisma.$transaction(transactionOperations);

    // Buscar viagem atualizada
    const updatedTrip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        trailer: true,
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: true,
        legs: {
          orderBy: { legNumber: 'asc' },
          include: {
            driver: { select: { id: true, name: true } },
            trailer: { select: { id: true, plate: true } },
          },
        },
      },
    });

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error pausing trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/:id/resume - Continuar viagem após carregamento/descarregamento
router.post('/:id/resume', async (req, res) => {
  try {
    const { id } = req.params;
    const { currentMileage } = req.body;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        legs: {
          orderBy: { legNumber: 'asc' },
        },
        truck: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.status !== 'IN_PROGRESS') {
      return res.status(400).json({ 
        message: 'Only in progress trips can be resumed' 
      });
    }

    const pausedLeg = trip.legs.find(leg => leg.status === 'PAUSED');
    if (!pausedLeg) {
      return res.status(400).json({ message: 'No paused leg found' });
    }

    if (pausedLeg.type !== 'AGUARDANDO') {
      return res.status(400).json({ message: 'Can only resume waiting legs' });
    }

    // Verificar se o caminhão participou de outras viagens desde o início da pausa
    const otherTripsInPeriod = await prisma.tripLeg.findFirst({
      where: {
        truckId: trip.truckId!,
        tripId: { not: trip.id },
        startTime: {
          gte: pausedLeg.startTime,
        },
        status: { in: ['IN_PROGRESS', 'COMPLETED'] },
      },
    });

    // Se encontrou outras viagens E não forneceu km, pedir
    if (otherTripsInPeriod && !currentMileage) {
      return res.status(400).json({ 
        message: 'O caminhão participou de outras viagens. Informe a quilometragem atual.',
        requiresMileage: true,
      });
    }

    // Determinar quilometragem final
    let finalMileage: number;
    
    if (currentMileage) {
      finalMileage = parseFloat(currentMileage);
      const distance = finalMileage - pausedLeg.startMileage;
      if (distance < 0) {
        return res.status(400).json({ 
          message: 'A quilometragem atual deve ser maior ou igual à inicial' 
        });
      }
    } else {
      // Se não forneceu km e não tem outras viagens, usar km do início (caminhão ficou parado)
      finalMileage = pausedLeg.startMileage;
    }

    const continueDescription = pausedLeg.waitingType === 'LOADING' 
      ? 'Continuando após carregamento'
      : 'Continuando após descarregamento';

    // Calcular distância do leg de aguardamento (geralmente 0, mas pode ter movido)
    const waitingDistance = finalMileage - pausedLeg.startMileage;

    // Finalizar trecho de aguardamento e criar novo trecho em andamento
    const transactionOperations: any[] = [
      // Finalizar trecho de aguardamento
      prisma.tripLeg.update({
        where: { id: pausedLeg.id },
        data: {
          endMileage: finalMileage,
          distance: waitingDistance,
          endTime: new Date(),
          status: 'COMPLETED',
          destination: pausedLeg.origin, // Destino é o mesmo que origem (ficou parado)
        },
      }),
      // Criar novo trecho em andamento
      prisma.tripLeg.create({
        data: {
          tripId: trip.id,
          legNumber: pausedLeg.legNumber + 1,
          type: 'NORMAL',
          origin: pausedLeg.origin,
          truckId: pausedLeg.truckId,
          trailerId: pausedLeg.trailerId,
          driverId: pausedLeg.driverId,
          startMileage: finalMileage,
          status: 'IN_PROGRESS',
          startTime: new Date(),
          notes: continueDescription,
        },
      }),
    ];

    // Atualizar quilometragem do caminhão se mudou
    if (trip.truck && finalMileage !== trip.truck.currentMileage) {
      transactionOperations.push(
        prisma.truck.update({
          where: { id: pausedLeg.truckId },
          data: { currentMileage: finalMileage },
        })
      );
    }

    await prisma.$transaction(transactionOperations);

    // Buscar viagem atualizada
    const updatedTrip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        trailer: true,
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: true,
        legs: {
          orderBy: { legNumber: 'asc' },
          include: {
            driver: { select: { id: true, name: true } },
            trailer: { select: { id: true, plate: true } },
          },
        },
      },
    });

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error resuming trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/:id/finish - Finalizar uma viagem
router.post('/:id/finish', async (req, res) => {
  try {
    const { id } = req.params;
    const { endDate, endMileage } = req.body;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        expenses: true,
        truck: true,
        driver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.status !== 'IN_PROGRESS') {
      return res.status(400).json({ 
        message: 'Only in progress trips can be finished' 
      });
    }

    // Calcular distância percorrida baseada nos legs (soma das distâncias dos trechos)
    // Isso garante que múltiplas viagens simultâneas não afetem o cálculo
    const completedLegs = await prisma.tripLeg.findMany({
      where: {
        tripId: trip.id,
        status: 'COMPLETED',
      },
      orderBy: { legNumber: 'asc' },
    });

    // Buscar leg ativo para finalizar
    const activeLeg = await prisma.tripLeg.findFirst({
      where: {
        tripId: trip.id,
        status: 'IN_PROGRESS',
      },
      orderBy: { legNumber: 'desc' },
    });

    let finalEndMileage = endMileage ? parseFloat(endMileage) : null;
    let finalDistance = 0;
    
    // Somar distâncias dos legs já completados (excluindo AGUARDANDO que têm distance 0)
    finalDistance = completedLegs
      .filter(leg => leg.type !== 'AGUARDANDO' && leg.distance != null)
      .reduce((sum, leg) => sum + leg.distance, 0);

    // Adicionar distância do leg final
    if (activeLeg && finalEndMileage) {
      const finalLegDistance = finalEndMileage - activeLeg.startMileage;
      
      // Validação: quilometragem final deve ser maior que inicial do leg
      if (finalLegDistance < 0) {
        return res.status(400).json({ 
          message: 'A quilometragem final deve ser maior que a quilometragem do último trecho' 
        });
      }
      
      finalDistance += finalLegDistance;
      
      // Finalizar leg ativo
      await prisma.tripLeg.update({
        where: { id: activeLeg.id },
        data: {
          endMileage: finalEndMileage,
          distance: finalLegDistance,
          endTime: new Date(),
          status: 'COMPLETED',
        },
      });
    } else if (!finalEndMileage) {
      return res.status(400).json({ 
        message: 'Informe a quilometragem final para concluir a viagem' 
      });
    }

    // Calcular custos totais a partir das despesas
    const fuelCost = trip.expenses
      .filter((e) => e.type === 'FUEL')
      .reduce((sum, e) => sum + e.amount, 0);

    const tollCost = trip.expenses
      .filter((e) => e.type === 'TOLL')
      .reduce((sum, e) => sum + e.amount, 0);

    const otherCosts = trip.expenses
      .filter((e) => e.type !== 'FUEL' && e.type !== 'TOLL')
      .reduce((sum, e) => sum + e.amount, 0);

    // Calcular consumo de combustível baseado na kilometragem e consumo do caminhão
    let calculatedFuelCost = fuelCost;
    let shouldCreateFuelExpense = false;
    let estimatedFuelCost = 0;
    let litersConsumed = 0;
    
    if (trip.truck && finalDistance > 0 && trip.truck.avgConsumption && trip.truck.avgConsumption > 0) {
      // Buscar preço do diesel nas configurações
      const settings = await prisma.settings.findFirst();
      const dieselPrice = settings?.dieselPrice || 0;
      
      if (dieselPrice > 0) {
        // Calcular litros consumidos = distância / km por litro
        litersConsumed = finalDistance / trip.truck.avgConsumption;
        // Calcular custo estimado
        estimatedFuelCost = litersConsumed * dieselPrice;
        
        // Se não há despesas de combustível registradas, usar o cálculo estimado
        if (fuelCost === 0) {
          calculatedFuelCost = estimatedFuelCost;
          shouldCreateFuelExpense = true; // Marcar para criar expense
        }
      }
    }

    const totalCost = calculatedFuelCost + tollCost + otherCosts;
    const profit = trip.revenue - totalCost;
    const profitMargin = trip.revenue > 0 ? (profit / trip.revenue) * 100 : 0;

    // Atualizar trip, retornar caminhão para garagem, atualizar quilometragem e criar despesa de combustível se necessário
    const transactionOperations: any[] = [
      prisma.trip.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          endDate: endDate ? new Date(endDate) : new Date(),
          distance: finalDistance,
          endMileage: finalEndMileage,
          fuelCost: calculatedFuelCost,
          tollCost,
          otherCosts,
          totalCost,
          profit,
          profitMargin,
        },
        include: {
          truck: true,
          driver: {
            select: { id: true, name: true, email: true },
          },
          expenses: true,
        },
      }),
      prisma.truck.update({
        where: { id: trip.truckId! },
        data: { 
          status: 'GARAGE',
          // Atualizar quilometragem atual do caminhão se foi informada
          ...(finalEndMileage && { currentMileage: finalEndMileage }),
        },
      }),
    ];

    // Adicionar criação de despesa de combustível se foi calculada automaticamente
    if (shouldCreateFuelExpense) {
      transactionOperations.push(
        prisma.expense.create({
          data: {
            truckId: trip.truckId,
            tripId: trip.id,
            type: 'FUEL',
            description: `Combustível calculado automaticamente (${litersConsumed.toFixed(2)}L)`,
            amount: estimatedFuelCost,
            date: endDate ? new Date(endDate) : new Date(),
          },
        })
      );
    }

    const [updatedTrip] = await prisma.$transaction(transactionOperations);

    // Enviar webhook de corrida finalizada
    await sendWebhook('trip.completed', {
      trip: {
        id: updatedTrip.id,
        origin: updatedTrip.origin,
        destination: updatedTrip.destination,
        revenue: updatedTrip.revenue,
        totalCost: updatedTrip.totalCost,
        profit: updatedTrip.profit,
        profitMargin: updatedTrip.profitMargin,
      },
      truck: {
        plate: updatedTrip.truck.plate,
        model: updatedTrip.truck.model,
      },
      driver: {
        name: updatedTrip.driver.name,
        email: updatedTrip.driver.email,
      },
    });

    // Verificar se o lucro está abaixo do limite
    if (profitMargin < config.PROFIT_LOW_THRESHOLD * 100) {
      await sendWebhook('trip.low_profit', {
        trip: {
          id: updatedTrip.id,
          origin: updatedTrip.origin,
          destination: updatedTrip.destination,
          profit: updatedTrip.profit,
          profitMargin: updatedTrip.profitMargin,
        },
        threshold: config.PROFIT_LOW_THRESHOLD * 100,
      });
    }

    res.json(updatedTrip);
  } catch (error) {
    console.error('Error finishing trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/trips/:id - Atualizar uma viagem
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const { tripCode, truckId, trailerId, driverId, clientId, origin, destination, startDate, endDate, revenue, distance, notes, status } = req.body;

    // Apenas ADMIN e MANAGER podem editar viagens
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({ 
        message: 'Apenas administradores e gerentes podem editar viagens' 
      });
    }

    // Validar campos obrigatórios se fornecidos
    if (clientId === '') {
      return res.status(400).json({ 
        message: 'Cliente é obrigatório' 
      });
    }

    // Buscar viagem atual
    const currentTrip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        driver: true,
      },
    });

    if (!currentTrip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // Permitir edição de viagens PLANNED, DELAYED e COMPLETED (para ADMIN/MANAGER)
    const canEditCompleted = currentTrip.status === 'COMPLETED' && (user.role === 'ADMIN' || user.role === 'MANAGER');
    const canEditPlanned = currentTrip.status === 'PLANNED' || currentTrip.status === 'DELAYED';
    
    if (!canEditPlanned && !canEditCompleted) {
      return res.status(400).json({ 
        message: 'Esta viagem não pode ser editada no momento' 
      });
    }

    // Se alterar caminhão ou motorista, buscar os novos dados
    let truck = currentTrip.truck;
    let driver = currentTrip.driver;
    let trailer = null;

    if (truckId && truckId !== currentTrip.truckId) {
      const newTruck = await prisma.truck.findUnique({
        where: { id: truckId },
      });
      if (!newTruck) {
        return res.status(404).json({ message: 'Truck not found' });
      }
      truck = newTruck;
    }

    if (driverId && driverId !== currentTrip.driverId) {
      const newDriver = await prisma.user.findUnique({
        where: { id: driverId },
      });
      if (!newDriver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
      driver = newDriver;
    }

    if (trailerId !== undefined) {
      if (trailerId) {
        const newTrailer = await prisma.trailer.findUnique({
          where: { id: trailerId },
        });
        if (!newTrailer) {
          return res.status(404).json({ message: 'Trailer not found' });
        }
        trailer = newTrailer;
      }
    }

    // Validar cliente se fornecido
    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
      });
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
    }

    // Preparar dados de atualização
    const updateData: any = {
      ...(tripCode !== undefined && { tripCode }),
      ...(truckId && { truckId }),
      ...(trailerId !== undefined && { trailerId: trailerId || null }),
      ...(driverId && { driverId }),
      ...(clientId && { clientId }),
      ...(origin && { origin }),
      ...(destination && { destination }),
      ...(startDate && { startDate: new Date(startDate) }),
      ...(endDate && { endDate: new Date(endDate) }),
      ...(revenue !== undefined && { revenue: parseFloat(revenue) }),
      ...(distance !== undefined && { distance: parseFloat(distance) }),
      ...(notes !== undefined && { notes }),
      ...(status && { status }),
    };

    // Se for viagem COMPLETED, recalcular valores baseado nas despesas
    if (currentTrip.status === 'COMPLETED') {
      const expenses = await prisma.expense.findMany({
        where: { tripId: id },
      });

      const fuelCost = expenses
        .filter((e) => e.type === 'FUEL')
        .reduce((sum, e) => sum + e.amount, 0);

      const tollCost = expenses
        .filter((e) => e.type === 'TOLL')
        .reduce((sum, e) => sum + e.amount, 0);

      const otherCosts = expenses
        .filter((e) => e.type !== 'FUEL' && e.type !== 'TOLL')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalCost = fuelCost + tollCost + otherCosts;
      const finalRevenue = revenue !== undefined ? parseFloat(revenue) : currentTrip.revenue;
      const profit = finalRevenue - totalCost;
      const profitMargin = finalRevenue > 0 ? (profit / finalRevenue) * 100 : 0;

      updateData.fuelCost = fuelCost;
      updateData.tollCost = tollCost;
      updateData.otherCosts = otherCosts;
      updateData.totalCost = totalCost;
      updateData.profit = profit;
      updateData.profitMargin = profitMargin;
    }

    const trip = await prisma.trip.update({
      where: { id },
      data: updateData,
      include: {
        truck: true,
        trailer: true,
        driver: {
          select: { id: true, name: true, email: true, phone: true },
        },
        client: {
          select: { id: true, name: true, cnpj: true },
        },
      },
    });

    // Registrar alteração nos logs de auditoria
    const changedFields = Object.keys(updateData).filter(key => {
      const oldValue = (currentTrip as any)[key];
      const newValue = updateData[key];
      return JSON.stringify(oldValue) !== JSON.stringify(newValue);
    });

    if (changedFields.length > 0) {
      await logAction({
        userId: user.userId,
        userName: user.name || user.email,
        userRole: user.role,
        action: LogAction.UPDATE,
        entity: LogEntity.TRIP,
        entityId: id,
        details: {
          changedFields,
          oldValues: changedFields.reduce((acc, field) => {
            acc[field] = (currentTrip as any)[field];
            return acc;
          }, {} as any),
          newValues: changedFields.reduce((acc, field) => {
            acc[field] = updateData[field];
            return acc;
          }, {} as any),
          tripCode: trip.tripCode,
          status: trip.status,
        },
        req,
      });
    }

    // Enviar webhook de viagem atualizada (como se fosse nova viagem agendada)
    // Apenas enviar se tiver caminhão e motorista atribuídos
    if (truck && driver) {
      await sendWebhook('trip.scheduled', {
        trip: {
          id: trip.id,
          tripCode: trip.tripCode,
          origin: trip.origin,
          destination: trip.destination,
          startDate: trip.startDate,
          revenue: trip.revenue,
          updated: true, // Flag indicando que é uma atualização
        },
        truck: {
          id: truck.id,
          plate: truck.plate,
          model: truck.model,
          brand: truck.brand,
        },
        trailer: trailer ? {
          id: trailer.id,
          plate: trailer.plate,
          model: trailer.model,
          brand: trailer.brand,
        } : null,
        driver: {
          id: driver.id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
        },
        client: trip.client ? {
          clientId: trip.client.id,
          name: trip.client.name,
          cnpj: trip.client.cnpj?.replace(/\D/g, '') || null,
        } : null,
        updatedBy: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
      });
    }

    res.json(trip);
  } catch (error: any) {
    console.error('Error updating trip:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/trips/:id - Deletar uma viagem
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Buscar a viagem
    const trip = await prisma.trip.findUnique({
      where: { id },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    // ADMIN pode excluir qualquer viagem
    // MANAGER pode excluir apenas viagens PLANNED
    if (user.role !== 'ADMIN') {
      if (user.role !== 'MANAGER') {
        return res.status(403).json({ 
          message: 'Você não tem permissão para excluir viagens' 
        });
      }
      
      if (trip.status !== 'PLANNED') {
        return res.status(403).json({ 
          message: 'Gerentes podem excluir apenas viagens planejadas' 
        });
      }
    }

    // Excluir todas as despesas associadas a esta viagem
    await prisma.expense.deleteMany({
      where: { tripId: id },
    });

    await prisma.trip.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting trip:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Trip not found' });
    }
    
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/:id/send-reminder - Enviar lembrete manual para o motorista
router.post('/:id/send-reminder', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Apenas ADMIN e MANAGER podem enviar lembretes
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({ 
        message: 'Apenas administradores e gerentes podem enviar lembretes' 
      });
    }

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        driver: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Viagem não encontrada' });
    }

    // Enviar webhook de lembrete
    await sendWebhook('trip.reminder', {
      trip: {
        id: trip.id,
        origin: trip.origin,
        destination: trip.destination,
        startDate: trip.startDate,
        status: trip.status,
        revenue: trip.revenue,
      },
      truck: {
        id: trip.truck!.id,
        plate: trip.truck!.plate,
        model: trip.truck!.model,
        brand: trip.truck!.brand,
      },
      driver: {
        id: trip.driver!.id,
        name: trip.driver!.name,
        email: trip.driver!.email,
        phone: trip.driver!.phone,
      },
      sentBy: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    res.json({ 
      message: 'Lembrete enviado com sucesso',
      trip: {
        id: trip.id,
        driver: trip.driver!.name,
      },
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/:id/send-message - Enviar mensagem customizada ao motorista via webhook
router.post('/:id/send-message', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const user = (req as any).user;

    // Apenas ADMIN e MANAGER podem enviar mensagens deste tipo
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({ message: 'Apenas administradores e gerentes podem enviar mensagens' });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ message: 'Mensagem inválida' });
    }

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        truck: true,
        driver: true,
      },
    });

    if (!trip) return res.status(404).json({ message: 'Viagem não encontrada' });

    // Verificar se a viagem tem caminhão e motorista
    if (!trip.truck || !trip.driver) {
      return res.status(400).json({ 
        message: 'A viagem deve ter caminhão e motorista atribuídos' 
      });
    }

    // Enviar webhook com o evento trip.message
    await sendWebhook('trip.message', {
      trip: {
        id: trip.id,
        origin: trip.origin,
        destination: trip.destination,
        startDate: trip.startDate,
        status: trip.status,
        revenue: trip.revenue,
      },
      truck: {
        id: trip.truck!.id,
        plate: trip.truck!.plate,
        model: trip.truck!.model,
        brand: trip.truck!.brand,
      },
      driver: {
        id: trip.driver!.id,
        name: trip.driver!.name,
        email: trip.driver!.email,
        phone: trip.driver!.phone,
      },
      message: message.trim(),
      sentBy: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    res.json({ message: 'Mensagem enviada com sucesso' });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/check-delayed - Verificar e atualizar viagens em atraso
router.post('/check-delayed', async (req, res) => {
  try {
    const now = new Date();
    
    // Buscar viagens planejadas que já passaram do horário
    const delayedTrips = await prisma.trip.findMany({
      where: {
        status: 'PLANNED',
        startDate: {
          lt: now,
        },
      },
    });

    // Atualizar status para DELAYED
    if (delayedTrips.length > 0) {
      await prisma.trip.updateMany({
        where: {
          id: {
            in: delayedTrips.map(t => t.id),
          },
        },
        data: {
          status: 'DELAYED',
        },
      });

      // Enviar webhook para cada viagem atrasada
      for (const trip of delayedTrips) {
        const tripWithDetails = await prisma.trip.findUnique({
          where: { id: trip.id },
          include: {
            truck: true,
            driver: true,
          },
        });

        if (tripWithDetails && tripWithDetails.truck && tripWithDetails.driver) {
          await sendWebhook('trip.delayed', {
            trip: {
              id: tripWithDetails.id,
              origin: tripWithDetails.origin,
              destination: tripWithDetails.destination,
              startDate: tripWithDetails.startDate,
            },
            truck: {
              plate: tripWithDetails.truck.plate,
            },
            driver: {
              name: tripWithDetails.driver.name,
              phone: tripWithDetails.driver.phone,
            },
          });
        }
      }
    }

    res.json({ 
      message: `${delayedTrips.length} trip(s) marked as delayed`,
      count: delayedTrips.length,
    });
  } catch (error) {
    console.error('Error checking delayed trips:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/trips/check-upcoming - Verificar viagens próximas (1h antes)
router.post('/check-upcoming', async (req, res) => {
  try {
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Buscar viagens planejadas que começam em 1h
    const upcomingTrips = await prisma.trip.findMany({
      where: {
        status: 'PLANNED',
        startDate: {
          gte: now,
          lte: oneHourFromNow,
        },
      },
      include: {
        truck: true,
        driver: true,
      },
    });

    // Enviar webhook para cada viagem próxima
    for (const trip of upcomingTrips) {
      if (trip.truck && trip.driver) {
        await sendWebhook('trip.upcoming', {
          trip: {
            id: trip.id,
            origin: trip.origin,
            destination: trip.destination,
            startDate: trip.startDate,
          },
          truck: {
            plate: trip.truck.plate,
            model: trip.truck.model,
          },
          driver: {
            name: trip.driver.name,
            phone: trip.driver.phone,
            email: trip.driver.email,
          },
        });
      }
    }

    res.json({ 
      message: `${upcomingTrips.length} upcoming trip(s) found`,
      count: upcomingTrips.length,
    });
  } catch (error) {
    console.error('Error checking upcoming trips:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/trips/:id/confirm - Confirmar viagem recebida via API
router.put('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Apenas ADMIN e MANAGER podem confirmar viagens
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({
        message: 'Apenas administradores e gerentes podem confirmar viagens',
      });
    }

    const {
      truckId,
      trailerId,
      driverId,
      origin,
      destination,
      startDate,
      endDate,
      distance,
      revenue,
      notes,
    } = req.body;

    // Buscar viagem
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Viagem não encontrada' });
    }

    if (trip.status !== 'RECEIVED') {
      return res.status(400).json({
        message: 'Apenas viagens com status RECEIVED podem ser confirmadas',
        currentStatus: trip.status,
      });
    }

    // Validar campos obrigatórios
    if (!truckId || !driverId) {
      return res.status(400).json({
        message: 'Caminhão e motorista são obrigatórios para confirmar a viagem',
      });
    }

    // Verificar se truck existe
    const truck = await prisma.truck.findUnique({
      where: { id: truckId },
    });

    if (!truck) {
      return res.status(404).json({ message: 'Caminhão não encontrado' });
    }

    // Verificar se driver existe
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      return res.status(404).json({ message: 'Motorista não encontrado' });
    }

    // Verificar trailer se fornecido
    if (trailerId) {
      const trailer = await prisma.trailer.findUnique({
        where: { id: trailerId },
      });

      if (!trailer) {
        return res.status(404).json({ message: 'Carreta não encontrada' });
      }
    }

    // Atualizar viagem com todos os dados
    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        truckId,
        trailerId: trailerId || null,
        driverId,
        origin: origin || trip.origin,
        destination: destination || trip.destination,
        // Se não enviar startDate mas a viagem era RECEIVED, manter a data original
        // Caso envie nova data, usar ela
        startDate: startDate ? new Date(startDate) : trip.startDate,
        endDate: endDate ? new Date(endDate) : trip.endDate,
        distance: distance !== undefined ? distance : trip.distance,
        revenue: revenue !== undefined ? revenue : trip.revenue,
        notes: notes || trip.notes,
        status: 'PLANNED', // Muda para PLANNED após confirmação
      },
      include: {
        client: true,
        truck: true,
        trailer: true,
        driver: true,
      },
    });

    // Enviar webhook para cliente externo notificando confirmação
    await sendWebhook('trip.confirmed', {
      tripId: updatedTrip.id,
      tripCode: updatedTrip.tripCode,
      status: 'CONFIRMED',
      client: {
        cnpj: updatedTrip.client?.cnpj,
        name: updatedTrip.client?.name,
      },
      truck: {
        plate: updatedTrip.truck?.plate,
        model: updatedTrip.truck?.model,
      },
      trailer: updatedTrip.trailer ? {
        plate: updatedTrip.trailer.plate,
        model: updatedTrip.trailer.model,
      } : null,
      driver: {
        name: updatedTrip.driver?.name,
        cpf: updatedTrip.driver?.cpf,
        phone: updatedTrip.driver?.phone,
      },
      origin: updatedTrip.origin,
      destination: updatedTrip.destination,
      startDate: updatedTrip.startDate,
      endDate: updatedTrip.endDate,
      distance: updatedTrip.distance,
      revenue: updatedTrip.revenue,
      confirmedAt: new Date().toISOString(),
    });

    console.log(`[Trip Confirmed] ${updatedTrip.tripCode} - Cliente: ${updatedTrip.client?.name}`);

    res.json({
      message: 'Viagem confirmada com sucesso',
      trip: updatedTrip,
    });
  } catch (error) {
    console.error('Error confirming trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT /api/trips/:id/reject - Recusar viagem recebida via API
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    // Apenas ADMIN e MANAGER podem recusar viagens
    if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
      return res.status(403).json({
        message: 'Apenas administradores e gerentes podem recusar viagens',
      });
    }

    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return res.status(400).json({
        message: 'Motivo da recusa é obrigatório',
      });
    }

    // Buscar viagem
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        client: true,
      },
    });

    if (!trip) {
      return res.status(404).json({ message: 'Viagem não encontrada' });
    }

    if (trip.status !== 'RECEIVED') {
      return res.status(400).json({
        message: 'Apenas viagens com status RECEIVED podem ser recusadas',
        currentStatus: trip.status,
      });
    }

    // Enviar webhook para cliente externo notificando recusa (antes de excluir)
    await sendWebhook('trip.rejected', {
      tripId: trip.id,
      tripCode: trip.tripCode,
      status: 'REJECTED',
      rejectionReason: rejectionReason.trim(),
      client: {
        cnpj: trip.client?.cnpj,
        name: trip.client?.name,
      },
      rejectedAt: new Date().toISOString(),
    });

    console.log(`[Trip Rejected] ${trip.tripCode} - Motivo: ${rejectionReason}`);

    // Excluir viagem do banco de dados (permite reenvio)
    await prisma.trip.delete({
      where: { id },
    });

    res.json({
      message: 'Viagem recusada e removida do sistema com sucesso',
      tripCode: trip.tripCode,
      rejectionReason: rejectionReason.trim(),
    });
  } catch (error) {
    console.error('Error rejecting trip:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;

