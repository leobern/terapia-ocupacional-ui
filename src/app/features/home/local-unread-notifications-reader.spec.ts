import { LocalUnreadNotificationsReader } from './local-unread-notifications-reader';

describe('LocalUnreadNotificationsReader', () => {
  it('reports no unread notifications', async () => {
    expect(await new LocalUnreadNotificationsReader().countUnread()).toBe(0);
  });
});
