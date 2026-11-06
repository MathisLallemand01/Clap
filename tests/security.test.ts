import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanReferral, safeExternalUrl, safePath } from '../src/lib/security.ts';

test('redirections : uniquement des chemins internes', () => {
  assert.equal(safePath('/collection?vue=roles#x'), '/collection?vue=roles#x');
  for (const bad of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/a\nb', '', null, 42, '/' + 'a'.repeat(600)]) {
    assert.equal(safePath(bad, '/bobines'), '/bobines', String(bad));
  }
});

test('parrainage : seul un code propre passe dans le cookie', () => {
  assert.equal(cleanReferral('ca-7k4q'), 'CA-7K4Q');
  assert.equal(cleanReferral('<script>'), '');
  assert.equal(cleanReferral('x'.repeat(40)), '');
});

test('liens externes : https et hôtes attendus seulement', () => {
  const hosts = /(^|\.)(apple\.com|deezer\.com)$/;
  assert.equal(safeExternalUrl('https://music.apple.com/fr/x', hosts), 'https://music.apple.com/fr/x');
  assert.equal(safeExternalUrl('javascript:alert(1)', hosts), null);
  assert.equal(safeExternalUrl('http://music.apple.com/x', hosts), null);
  assert.equal(safeExternalUrl('https://apple.com.evil.net/x', hosts), null);
});
