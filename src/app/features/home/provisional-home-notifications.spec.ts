import { ProvisionalHomeNotificationsSource } from './provisional-home-notifications';

describe('ProvisionalHomeNotificationsSource', () => {
  it('resolves an empty list', async () => {
    expect(await new ProvisionalHomeNotificationsSource().loadForHospital()).toEqual([]);
  });
});
