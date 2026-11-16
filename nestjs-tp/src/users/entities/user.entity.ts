import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Tabla `User` que ya trae la base (la del servicio original). Rol: `isAdmin`
 * en `true` → admin; en `false` → viewer.
 */
@Entity({ name: 'User' })
export class User {
  @PrimaryGeneratedColumn({ name: 'UserId' })
  id: number;

  @Column({ name: 'Username', type: 'varchar', length: 80 })
  username: string;

  @Column({ name: 'Email', type: 'varchar', length: 120 })
  email: string;

  @Column({ name: 'FullName', type: 'varchar', length: 120, nullable: true })
  fullName: string | null;

  // En SQLite son enteros 0/1; TypeORM los entrega como booleanos.
  @Column({ name: 'Disabled', type: 'boolean', default: false })
  disabled: boolean;

  @Column({ name: 'IsAdmin', type: 'boolean', default: false })
  isAdmin: boolean;

  /**
   * `select: false`: el hash NO se carga en las consultas normales (spec 002
   * RNF-1). Solo el login lo pide a propósito. Así, aunque alguien devolviera
   * la entidad entera por error, el hash no saldría en la respuesta.
   */
  @Column({
    name: 'HashedPassword',
    type: 'varchar',
    length: 255,
    select: false,
  })
  hashedPassword?: string;
}
