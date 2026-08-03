import assert from 'node:assert/strict';
import { formatMaterialTitle, normalizeMaterialTitle } from '../../ui/materialTitle.ts';

const cases = [
  ['狼', '《狼》'],
  ['《狼》', '《狼》'],
  ['《《狼》》', '《狼》'],
  ['谭嗣同《潼关》', '谭嗣同《潼关》'],
  ['《谭嗣同《潼关》》', '谭嗣同《潼关》'],
] as const;

for (const [input, expected] of cases) {
  assert.equal(normalizeMaterialTitle(input), expected);
}
assert.equal(normalizeMaterialTitle(''), '');
assert.equal(formatMaterialTitle(''), '未命名材料');

console.log(`Material title debug: ${cases.length + 2}/${cases.length + 2} passed.`);
