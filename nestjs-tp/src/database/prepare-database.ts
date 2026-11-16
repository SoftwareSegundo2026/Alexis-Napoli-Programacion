import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Deja lista la base de trabajo (RNF-4): si no existe, la crea copiando la
 * plantilla; si ya existe, no la toca (conserva los datos de trabajo).
 * La plantilla solo se lee, nunca se abre con el ORM ni se escribe.
 */
export function prepareDatabase(
  databasePath: string,
  templatePath: string,
): void {
  if (existsSync(databasePath)) {
    return;
  }
  if (!existsSync(templatePath)) {
    throw new Error(
      `No se encontró la base plantilla en "${templatePath}": no se puede crear la base de trabajo.`,
    );
  }
  mkdirSync(dirname(databasePath), { recursive: true });
  copyFileSync(templatePath, databasePath);
}
