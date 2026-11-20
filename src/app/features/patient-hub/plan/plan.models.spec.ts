import { normalizeRoutes, routeLabel } from './plan.models';

describe('plan.models', () => {
  it('padroniza a ordem e remove duplicatas', () => {
    expect(normalizeRoutes(['NE', 'VO', 'NE'])).toEqual(['VO', 'NE']);
  });

  it('exibe combinações separadas por barra', () => {
    expect(routeLabel(['NE', 'VO'])).toBe('VO/NE');
    expect(routeLabel(['NP'])).toBe('NP');
    expect(routeLabel(['NP', 'NE', 'VO'])).toBe('VO/NE/NP');
  });
});
