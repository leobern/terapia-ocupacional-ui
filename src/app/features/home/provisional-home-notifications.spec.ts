import { ProvisionalHomeNotificationsSource } from './provisional-home-notifications';

describe('ProvisionalHomeNotificationsSource', () => {
  it('returns an empty last page', async () => {
    const page = await new ProvisionalHomeNotificationsSource().loadPage();

    expect(page).toEqual({ items: [], nextCursor: null });
  });
});
