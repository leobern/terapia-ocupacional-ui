export interface IEnvironment {
  production: boolean;
  apiBaseUrl: string;
  /** Liga as telas do EP-009 ao backend real, com token de teste (só `--configuration local`). */
  devBackend?: boolean;
}
