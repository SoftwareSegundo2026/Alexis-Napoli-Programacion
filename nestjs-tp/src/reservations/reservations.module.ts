import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConcertsModule } from '../concerts/concerts.module.js';
import { Payment } from './entities/payment.entity.js';
import { Reservation } from './entities/reservation.entity.js';
import { PAYMENT_GATEWAY, SimulatedPaymentGateway } from './payment-gateway.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsRepository } from './reservations.repository.js';
import { ReservationsService } from './reservations.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Reservation, Payment]), ConcertsModule],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    ReservationsRepository,
    // El medio de pago de la app es el simulado; los tests lo reemplazan (RNF-3).
    { provide: PAYMENT_GATEWAY, useClass: SimulatedPaymentGateway },
  ],
})
export class ReservationsModule {}
