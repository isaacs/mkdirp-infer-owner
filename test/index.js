const t = require('tap')
const requireInject = require('require-inject')
const { basename, dirname } = require('path')

const mockInferOwnerData = {
  root: { uid: 0, gid: 1 },
  user: { uid: 123, gid: 1234 },
  diffgid: { uid: 0, gid: 1234 },
}

const mockInferOwner = async path => mockInferOwnerData[basename(path)]
mockInferOwner.sync = path => mockInferOwnerData[basename(path)]

const mockMkdirp = async (path, opts) =>
  basename(dirname(path)) === 'exists' ? undefined : `MKDIRP ${path}`
mockMkdirp.sync = (path, opts) => 
  basename(dirname(path)) === 'exists' ? undefined : `MKDIRP SYNC ${path}`

const chownrLog = {}
const mockChownr = (path, uid, gid, cb) => {
  chownrLog['ASYNC ' + path] = {uid, gid}
  process.nextTick(cb)
}
mockChownr.sync = (path, uid, gid) => chownrLog['SYNC ' + path] = {uid, gid}

const noInferOwner = () => { throw new Error('this should not occur') }
noInferOwner.sync = () => { throw new Error('this should not occur') }
const noChownr = () => { throw new Error('this should not occur') }
noChownr.sync = () => { throw new Error('this should not occur') }

t.test('windows does not try to chown', t => {
  if (process.platform !== 'win32')
    process.env.__TESTING_MKDIRP_INFER_OWNER_PLATFORM__ = 'win32'
  t.teardown(() => process.env.__TESTING_MKDIRP_INFER_OWNER_PLATFORM__ = '')

  const mkdirp = requireInject('../', {
    mkdirp: mockMkdirp,
    chownr: noChownr,
    'infer-owner': noInferOwner,
  })
  process.getuid = () => 0
  process.getgid = () => 0

  t.strictSame([
    mkdirp.sync('/path/to/root'),
    mkdirp.sync('/path/to/user'),
    mkdirp.sync('/path/to/diffgid'),
    mkdirp.sync('/already/exists/root'),
    mkdirp.sync('/already/exists/user'),
    mkdirp.sync('/already/exists/diffgid'),
  ], [
    'MKDIRP SYNC /path/to/root',
    'MKDIRP SYNC /path/to/user',
    'MKDIRP SYNC /path/to/diffgid',
    undefined,
    undefined,
    undefined,
  ], 'sync usage')

  return Promise.all([
    mkdirp('/path/to/root'),
    mkdirp('/path/to/user'),
    mkdirp('/path/to/diffgid'),
    mkdirp('/already/exists/root'),
    mkdirp('/already/exists/user'),
    mkdirp('/already/exists/diffgid'),
  ]).then(results => t.strictSame(results, [
    'MKDIRP /path/to/root',
    'MKDIRP /path/to/user',
    'MKDIRP /path/to/diffgid',
    undefined,
    undefined,
    undefined,
  ], 'async usage'))
})

t.test('non-root doesnt try to chown', t => {
  if (process.platform === 'win32')
    process.env.__TESTING_MKDIRP_INFER_OWNER_PLATFORM__ = 'unix'
  t.teardown(() => process.env.__TESTING_MKDIRP_INFER_OWNER_PLATFORM__ = '')

  process.getuid = () => 123
  process.getgid = () => 1234
  const mkdirp = requireInject('../', {
    mkdirp: mockMkdirp,
    chownr: noChownr,
    'infer-owner': noInferOwner,
  })

  t.strictSame([
    mkdirp.sync('/path/to/root'),
    mkdirp.sync('/path/to/user'),
    mkdirp.sync('/path/to/diffgid'),
    mkdirp.sync('/already/exists/root'),
    mkdirp.sync('/already/exists/user'),
    mkdirp.sync('/already/exists/diffgid'),
  ], [
    'MKDIRP SYNC /path/to/root',
    'MKDIRP SYNC /path/to/user',
    'MKDIRP SYNC /path/to/diffgid',
    undefined,
    undefined,
    undefined,
  ], 'sync usage')

  return Promise.all([
    mkdirp('/path/to/root'),
    mkdirp('/path/to/user'),
    mkdirp('/path/to/diffgid'),
    mkdirp('/already/exists/root'),
    mkdirp('/already/exists/user'),
    mkdirp('/already/exists/diffgid'),
  ]).then(results => t.strictSame(results, [
    'MKDIRP /path/to/root',
    'MKDIRP /path/to/user',
    'MKDIRP /path/to/diffgid',
    undefined,
    undefined,
    undefined,
  ], 'async usage'))
})

t.test('root chowns when necessary', t => {
  if (process.platform === 'win32')
    process.env.__TESTING_MKDIRP_INFER_OWNER_PLATFORM__ = 'unix'
  t.teardown(() => process.env.__TESTING_MKDIRP_INFER_OWNER_PLATFORM__ = '')

  process.getuid = () => 0
  process.getgid = () => 1
  const mkdirp = requireInject('../', {
    mkdirp: mockMkdirp,
    chownr: mockChownr,
    'infer-owner': mockInferOwner,
  })

  t.strictSame([
    mkdirp.sync('/path/to/root'),
    mkdirp.sync('/path/to/user'),
    mkdirp.sync('/path/to/diffgid'),
    mkdirp.sync('/already/exists/root'),
    mkdirp.sync('/already/exists/user'),
    mkdirp.sync('/already/exists/diffgid'),
  ], [
    'MKDIRP SYNC /path/to/root',
    'MKDIRP SYNC /path/to/user',
    'MKDIRP SYNC /path/to/diffgid',
    undefined,
    undefined,
    undefined,
  ], 'sync usage')

  return Promise.all([
    mkdirp('/path/to/root'),
    mkdirp('/path/to/user'),
    mkdirp('/path/to/diffgid'),
    mkdirp('/already/exists/root'),
    mkdirp('/already/exists/user'),
    mkdirp('/already/exists/diffgid'),
  ]).then(results => t.strictSame(results, [
    'MKDIRP /path/to/root',
    'MKDIRP /path/to/user',
    'MKDIRP /path/to/diffgid',
    undefined,
    undefined,
    undefined,
  ], 'async usage')).then(() => t.strictSame(chownrLog, {
    'SYNC MKDIRP SYNC /path/to/user': { uid: 123, gid: 1234 },
    'SYNC MKDIRP SYNC /path/to/diffgid': { uid: 0, gid: 1234 },
    'ASYNC MKDIRP /path/to/user': { uid: 123, gid: 1234 },
    'ASYNC MKDIRP /path/to/diffgid': { uid: 0, gid: 1234 },
    'ASYNC /already/exists/user': { uid: 123, gid: 1234 },
    'ASYNC /already/exists/diffgid': { uid: 0, gid: 1234 },
    'SYNC /already/exists/user': { uid: 123, gid: 1234 },
    'SYNC /already/exists/diffgid': { uid: 0, gid: 1234 },
  }))
})
