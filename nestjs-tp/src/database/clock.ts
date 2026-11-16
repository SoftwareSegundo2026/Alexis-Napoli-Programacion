import { Injectable } from '@nestjs/common';

/**
 * Reloj inyectable (spec 004): "el concierto ya empezó" depende de la hora. La
 * app usa la hora del sistema; los tests reemplazan este provider para adelantar
 * el tiempo, en vez de crear conciertos en el pasado (que es 400, RF-1).
 */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
