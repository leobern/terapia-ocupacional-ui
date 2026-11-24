import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Contornos do ícone Sparkling (Figma 4722:25082), em viewBox 24x25. */
const SPARKLE_PATHS: readonly string[] = [
  'M0.501059 16.2907C0.159755 16.6625 -0.0198523 17.1548 0.00174482 17.659C0.023342 18.1633 0.244375 18.6383 0.616221 18.9797C0.988068 19.321 1.98454 19.479 1.98454 19.479C1.98454 19.479 3.75776 19.8888 4.57397 20.638C5.39019 21.3872 5.95014 23.1189 5.95014 23.1189C5.95014 23.1189 6.19277 24.0982 6.56461 24.4395C6.93646 24.7808 7.42866 24.9604 7.93293 24.9388C8.43721 24.9172 8.91225 24.6962 9.25355 24.3243C9.59485 23.9525 9.75287 22.956 9.75287 22.956C9.75287 22.956 10.1627 21.1828 10.9119 20.3665C11.661 19.5503 13.3927 18.9904 13.3927 18.9904C13.3927 18.9904 14.372 18.7478 14.7133 18.3759C15.0547 18.0041 15.2343 17.5119 15.2127 17.0076C15.1911 16.5033 14.97 16.0282 14.5982 15.6869C14.2263 15.3456 13.2299 15.1876 13.2299 15.1876C13.2299 15.1876 11.4566 14.7778 10.6404 14.0286C9.82422 13.2794 9.26427 11.5477 9.26427 11.5477C9.26427 11.5477 9.02164 10.5684 8.6498 10.2271C8.27795 9.88579 7.78575 9.70618 7.28148 9.72778C6.7772 9.74938 6.30216 9.97041 5.96086 10.3423C5.61955 10.7141 5.46154 11.7106 5.46154 11.7106C5.46154 11.7106 5.05171 13.4838 4.30253 14.3001C3.55336 15.1163 1.82168 15.6762 1.82168 15.6762C1.82168 15.6762 0.842362 15.9188 0.501059 16.2907Z',
  'M8.27814 3.18366C8.03673 3.36798 7.87844 3.64066 7.83807 3.9417C7.79771 4.24274 7.87858 4.54749 8.06291 4.7889C8.24723 5.0303 8.82095 5.22897 8.82095 5.22897C8.82095 5.22897 9.8283 5.65871 10.2329 6.18861C10.6375 6.71851 10.7867 7.80351 10.7867 7.80351C10.7867 7.80351 10.8272 8.40929 11.0115 8.6507C11.1959 8.89211 11.4685 9.05041 11.7696 9.09078C12.0706 9.13114 12.3754 9.05026 12.6168 8.86594C12.8582 8.68161 13.0568 8.10789 13.0568 8.10789C13.0568 8.10789 13.4866 7.10052 14.0165 6.69592C14.5464 6.29132 15.6314 6.14213 15.6314 6.14213C15.6314 6.14213 16.2371 6.10161 16.4785 5.91728C16.72 5.73296 16.8783 5.46028 16.9186 5.15924C16.959 4.8582 16.8781 4.55345 16.6938 4.31205C16.5095 4.07064 15.9357 3.87197 15.9357 3.87197C15.9357 3.87197 14.9284 3.44223 14.5238 2.91233C14.1192 2.38243 13.97 1.29743 13.97 1.29743C13.97 1.29743 13.9295 0.691646 13.7452 0.450236C13.5608 0.208826 13.2882 0.0505261 12.9871 0.0101621C12.6861 -0.0302019 12.3813 0.050676 12.1399 0.235003C11.8985 0.419329 11.6999 0.993047 11.6999 0.993047C11.6999 0.993047 11.2701 2.00042 10.7402 2.40502C10.2103 2.80962 9.12533 2.95882 9.12533 2.95882C9.12533 2.95882 8.51955 2.99933 8.27814 3.18366Z',
  'M17.5814 10.7252C17.4019 10.8342 17.2731 11.01 17.2233 11.214C17.1735 11.4179 17.2067 11.6333 17.3157 11.8128C17.4247 11.9922 17.8045 12.1709 17.8045 12.1709C17.8045 12.1709 18.4654 12.5401 18.7046 12.934C18.9438 13.3279 18.9668 14.0847 18.9668 14.0847C18.9668 14.0847 18.9502 14.504 19.0592 14.6835C19.1682 14.8629 19.344 14.9917 19.548 15.0416C19.752 15.0914 19.9674 15.0581 20.1468 14.9491C20.3263 14.8402 20.5049 14.4604 20.5049 14.4604C20.5049 14.4604 20.8742 13.7995 21.2681 13.5602C21.662 13.321 22.4187 13.298 22.4187 13.298C22.4187 13.298 22.838 13.3146 23.0175 13.2056C23.1969 13.0966 23.3257 12.9208 23.3756 12.7168C23.4254 12.5129 23.3921 12.2975 23.2831 12.118C23.1742 11.9385 22.7944 11.7599 22.7944 11.7599C22.7944 11.7599 22.1335 11.3907 21.8942 10.9968C21.655 10.6028 21.632 9.84613 21.632 9.84613C21.632 9.84613 21.6486 9.42676 21.5396 9.24731C21.4306 9.06786 21.2548 8.93905 21.0508 8.88923C20.8469 8.83941 20.6315 8.87265 20.452 8.98164C20.2726 9.09064 20.094 9.47042 20.094 9.47042C20.094 9.47042 19.7247 10.1313 19.3308 10.3706C18.9369 10.6098 18.1802 10.6328 18.1802 10.6328C18.1802 10.6328 17.7608 10.6162 17.5814 10.7252Z',
];

/** Cada logo na tela precisa de ids próprios para o recorte do contorno (vários logos na mesma página). */
let nextSparkleId = 0;

/**
 * Os 4 visuais do component set Figma `4424:6180` (`State=`). Espelha o Figma 1:1 — a
 * tradução de semântica (o que é decorativo, o que é controle) fica nos dois componentes
 * públicos, não aqui (research.md §9).
 */
export type IconLogoVisualState = 'default' | 'anim' | 'button' | 'disabled';

/**
 * Ícone Sparkling dentro do logo: `outline` (padrão: preenchido com surface e contornado), `solid` (preenchido com
 * `secondary`, aba ativa do menu) ou `none` (o logo do menu, sem o ícone).
 */
export type IconLogoSparkle = 'outline' | 'solid' | 'none';

/** Subconjunto exposto pelo componente decorativo público — `button` não faz sentido nele. */
export type IconLogoState = 'default' | 'anim' | 'disabled';

/**
 * Núcleo visual compartilhado do DS-component-icon-logo — **interno**, não exportado no
 * barrel público: instanciar diretamente não é suportado
 * (contracts/icon-logo.api.md § Fora do contrato).
 *
 * Dono de toda a pilha de camadas (`base` → `surface` → `blur` → `mesh` → luzes `anim`),
 * dos `mix-blend-mode`, da geometria da malha e da tabela de escala. Existe para que os dois
 * componentes públicos (`app-icon-logo` e `app-icon-logo-button`) compartilhem uma única
 * cópia do desenho — qualquer ajuste de fidelidade ao Figma acontece num só lugar.
 *
 * `lightsVisible` existe para o `:hover` do botão, que revela as 3 luzes **estáticas** (sem
 * órbita nem pulso) — o que diferencia o hover do estado `anim` (spec.md § Motion da
 * variante `button`).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-state]': 'state()',
    '[class.icon-logo--lights-visible]': 'lightsVisible()',
  },
  selector: 'app-icon-logo-visual',
  styleUrl: './icon-logo-visual.component.scss',
  templateUrl: './icon-logo-visual.component.html',
})
export class IconLogoVisualComponent {
  readonly state = input<IconLogoVisualState>('default');

  /** Revela as luzes sem animá-las (hover do botão). Ignorado quando `state === 'anim'`. */
  readonly lightsVisible = input<boolean>(false);

  readonly sparkle = input<IconLogoSparkle>('outline');

  protected readonly sparklePaths = SPARKLE_PATHS;
  protected readonly sparkleId = 'icon-logo-sparkle-' + nextSparkleId++;
}
