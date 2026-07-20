import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with Argon2id and verifies the original password', async () => {
    const hash = await service.hash('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).toContain('m=19456,t=2,p=1');
    await expect(
      service.verify(hash, 'correct horse battery staple'),
    ).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(
      service.verify(hash, 'wrong horse battery staple'),
    ).resolves.toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    await expect(
      service.verify('not-a-hash', 'whatever password'),
    ).resolves.toBe(false);
  });

  it('produces unique salts per hash', async () => {
    const [first, second] = await Promise.all([
      service.hash('same passphrase here'),
      service.hash('same passphrase here'),
    ]);
    expect(first).not.toBe(second);
  });
});
