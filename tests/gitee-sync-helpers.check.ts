import assert from 'node:assert/strict'
import test from 'node:test'

const {
  buildRepoContentPath,
  buildRepoContentsEndpoint,
  decodeBase64ToString,
  getRemoteFileContent,
  pickNestedFileEntry,
} = await import(new URL('../src/lib/sync/remote-file.ts', import.meta.url).href)

test('buildRepoContentPath keeps a full file path unchanged', () => {
  assert.equal(
    buildRepoContentPath({ path: '.data/tags.json' }),
    '.data/tags.json',
  )
})

test('buildRepoContentPath appends filename when path is a directory', () => {
  assert.equal(
    buildRepoContentPath({ path: '.settings', filename: 'store.json' }),
    '.settings/store.json',
  )
})

test('buildRepoContentPath avoids duplicating the filename', () => {
  assert.equal(
    buildRepoContentPath({ path: 'docs/note.md', filename: 'note.md' }),
    'docs/note.md',
  )
})

test('buildRepoContentPath normalizes spaces and encodes unicode segments', () => {
  assert.equal(
    buildRepoContentPath({ path: '同步 配置', filename: '标签 列表.json' }),
    '%E5%90%8C%E6%AD%A5_%E9%85%8D%E7%BD%AE/%E6%A0%87%E7%AD%BE_%E5%88%97%E8%A1%A8.json',
  )
})

test('buildRepoContentsEndpoint keeps the /contents/ separator', () => {
  assert.equal(
    buildRepoContentsEndpoint('.data/tags.json'),
    '/contents/.data/tags.json',
  )
})

test('getRemoteFileContent returns the content string for file responses', () => {
  assert.equal(
    getRemoteFileContent({ content: 'eyJvayI6dHJ1ZX0=' }, '.data/tags.json'),
    'eyJvayI6dHJ1ZX0=',
  )
})

test('pickNestedFileEntry prefers a child file with the requested name', () => {
  assert.deepEqual(
    pickNestedFileEntry(
      [
        { type: 'file', name: 'other.json', path: '.data/tags.json/other.json' },
        { type: 'file', name: 'tags.json', path: '.data/tags.json/tags.json' },
      ],
      '.data/tags.json',
    ),
    { type: 'file', name: 'tags.json', path: '.data/tags.json/tags.json' },
  )
})

test('pickNestedFileEntry falls back to the only child file', () => {
  assert.deepEqual(
    pickNestedFileEntry(
      [
        { type: 'file', name: 'legacy-uuid', path: '.data/tags.json/legacy-uuid', sha: '123' },
      ],
      '.data/tags.json',
    ),
    { type: 'file', name: 'legacy-uuid', path: '.data/tags.json/legacy-uuid', sha: '123' },
  )
})

test('getRemoteFileContent rejects directory responses', () => {
  assert.throws(
    () => getRemoteFileContent([{ name: 'tags.json' }], '.data/tags.json'),
    /指向的是目录/,
  )
})

test('decodeBase64ToString decodes utf-8 content', () => {
  assert.equal(
    decodeBase64ToString('5qCH562+'),
    '标签',
  )
})

test('decodeBase64ToString rejects non-base64 content', () => {
  assert.throws(
    () => decodeBase64ToString('undefined'),
    /不是有效的 Base64/,
  )
})
