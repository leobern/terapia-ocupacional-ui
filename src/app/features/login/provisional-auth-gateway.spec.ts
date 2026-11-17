import { ProvisionalAuthGateway } from './provisional-auth-gateway';

describe('ProvisionalAuthGateway', () => {
  it('reports network error until a backend exists', async () => {
    await expectAsync(new ProvisionalAuthGateway().login()).toBeResolvedTo({ kind: 'network-error' });
  });
});
