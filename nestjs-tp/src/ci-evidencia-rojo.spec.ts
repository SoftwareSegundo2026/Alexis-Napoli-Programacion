/**
 * FALLO INTENCIONAL — evidencia del TP-6 (spec 006, casos 1, 4 y 8).
 *
 * Esta rama existe solo para demostrar que un PR con un test en rojo NO se
 * puede mergear a `main`: el check `gates` falla en el paso "Unit tests", los
 * pasos siguientes no corren y GitHub muestra "Merging is blocked".
 * El PR se cierra sin mergear: este archivo nunca llega a `main`.
 */
describe('Evidencia de CI (fallo intencional)', () => {
  it('falla a propósito para que el merge quede bloqueado', () => {
    expect(1 + 1).toBe(3);
  });
});
