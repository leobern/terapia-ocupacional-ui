import { Provider } from '@angular/core';

import { FormulasApi } from '../../features/pharmacy/formulas-api';
import { HttpFormulasApi } from './http-formulas-api';

/**
 * Liga a farmácia (EP-009) ao backend real (`environment.devBackend`, `ng serve --configuration local`).
 * Vêm depois dos provisórios em `app.config.ts`, então os substituem.
 */
export const DEV_BACKEND_PROVIDERS: readonly Provider[] = [{ provide: FormulasApi, useClass: HttpFormulasApi }];
