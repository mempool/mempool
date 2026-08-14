import { getPrivateHandle } from '../../utils/private-acceleration';

describe('Private acceleration handles', () => {
  // Must match the services implementation.
  test('should match the agreed test vector', () => {
    expect(getPrivateHandle('4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b'))
      .toStrictEqual('3d7500750997bbc9ef80edf4771ee170eaf8079bec8f07d54721ac6ce6baa616');
  });
});
