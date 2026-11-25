import { ProvisionalTokenRefresher } from './provisional-token-refresher';
import { RefreshRejectedError } from './token-refresher';

describe('ProvisionalTokenRefresher', () => {
  it('rejects every renewal definitively while the API does not exist', async () => {
    await expectAsync(new ProvisionalTokenRefresher().refresh()).toBeRejectedWithError(RefreshRejectedError);
  });
});
