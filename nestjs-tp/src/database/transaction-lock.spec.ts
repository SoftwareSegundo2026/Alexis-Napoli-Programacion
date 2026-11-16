import { TransactionLock } from './transaction-lock.js';

/** Cede el turno al event loop (no es una espera por tiempo). */
const yieldTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('TransactionLock (spec 004, plan)', () => {
  it('ejecuta las tareas de a una, en orden de llegada, aunque cedan el turno', async () => {
    const lock = new TransactionLock();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`${name}:inicio`);
      await yieldTurn();
      await yieldTurn();
      log.push(`${name}:fin`);
      return name;
    };

    const results = await Promise.all([
      lock.run(task('a')),
      lock.run(task('b')),
      lock.run(task('c')),
    ]);

    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual([
      'a:inicio',
      'a:fin',
      'b:inicio',
      'b:fin',
      'c:inicio',
      'c:fin',
    ]);
  });

  it('informa cuántas tareas están corriendo o esperando (pending)', async () => {
    const lock = new TransactionLock();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = lock.run(() => gate);
    const second = lock.run(() => Promise.resolve());
    expect(lock.pending).toBe(2);

    release();
    await Promise.all([first, second]);
    expect(lock.pending).toBe(0);
  });

  it('si una tarea falla, propaga su error y la siguiente igual corre', async () => {
    const lock = new TransactionLock();

    const failing = lock.run(() => Promise.reject(new Error('falló')));
    const next = lock.run(() => Promise.resolve('siguió'));

    await expect(failing).rejects.toThrow('falló');
    await expect(next).resolves.toBe('siguió');
  });
});
