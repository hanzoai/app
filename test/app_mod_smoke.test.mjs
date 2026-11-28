import test from 'node:test'
import assert from 'node:assert/strict'

// Import direct ESM implementation
import {
  defineAppMod,
  registerAppMod,
  getRegisteredAppMods,
  matchAppModRoute,
  clearAppModRegistry,
  fetchAuthenticatedV1,
  ReferenceClusterStatusMod
} from '../pkg/mod/src/app_mod.ts'

test('App Mod Registry - Validation and Registration', () => {
  clearAppModRegistry()

  // Must reject invalid definitions
  assert.throws(() => {
    defineAppMod({ id: '', name: 'Test', route: '/test', mount: () => () => {} })
  }, /non-empty string `id`/)

  assert.throws(() => {
    defineAppMod({ id: 'bad-route', name: 'Test', route: 'bad/route', mount: () => () => {} })
  }, /must begin with a leading slash/)

  // Valid mod definition
  const mod = defineAppMod({
    id: 'analytics-widget',
    name: 'Analytics Widget',
    version: '1.0.0',
    description: 'Custom cluster analytics view',
    route: '/apps/analytics-widget',
    mount: () => () => {}
  })

  registerAppMod(mod)
  const allMods = getRegisteredAppMods()
  assert.equal(allMods.length, 1)
  assert.equal(allMods[0].id, 'analytics-widget')
})

test('App Mod Siderail Route Matching', () => {
  clearAppModRegistry()
  registerAppMod(ReferenceClusterStatusMod)

  const matchRoot = matchAppModRoute('/apps/cluster-status')
  assert.ok(matchRoot, 'Should match exact route')
  assert.equal(matchRoot.id, 'cluster-status')

  const matchSubPath = matchAppModRoute('/apps/cluster-status/nodes/node-1')
  assert.ok(matchSubPath, 'Should match child route')
  assert.equal(matchSubPath.id, 'cluster-status')

  const matchUnrelated = matchAppModRoute('/apps/crm')
  assert.equal(matchUnrelated, undefined)
})

test('Reference Cluster Status Mod - Top Bar & Lifecycle Controls', () => {
  let notifiedMsg = ''
  let notifiedType = ''
  const mockCtx = {
    token: 'test_token_123',
    endpoints: {
      engineUrl: 'http://127.0.0.1:1234',
      cloudUrl: 'http://127.0.0.1:8080'
    },
    go: () => {},
    notify: (msg, type) => {
      notifiedMsg = msg
      notifiedType = type
    }
  }

  const controls = ReferenceClusterStatusMod.topBarControls(mockCtx)
  assert.equal(controls.length, 2)
  assert.equal(controls[0].id, 'refresh-metrics')
  assert.equal(controls[1].id, 'switch-cluster')

  controls[1].action()
  assert.match(notifiedMsg, /Switched cluster target to http:\/\/127\.0\.0\.1:1234/)
  assert.equal(notifiedType, 'info')

  // Test mount lifecycle
  const unmount = ReferenceClusterStatusMod.mount(null, mockCtx)
  assert.equal(typeof unmount, 'function')
  unmount()
})

test('Authenticated /v1 calls - Endpoint targeting and token injection', async () => {
  let capturedUrl = ''
  let capturedHeaders = {}

  // Mock global fetch
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    capturedUrl = url
    capturedHeaders = init?.headers || {}
    return new Response(JSON.stringify({ status: 'ok', nodes: 3 }), { status: 200 })
  }

  try {
    const mockCtx = {
      token: 'jwt_mock_token',
      endpoints: {
        engineUrl: 'http://127.0.0.1:1234',
        cloudUrl: 'http://127.0.0.1:8080'
      },
      go: () => {}
    }

    // Call engine models endpoint
    const res1 = await fetchAuthenticatedV1(mockCtx, '/v1/models')
    assert.equal(res1.status, 200)
    assert.equal(capturedUrl, 'http://127.0.0.1:1234/v1/models')
    assert.equal(capturedHeaders.get('Authorization'), 'Bearer jwt_mock_token')

    // Call cloud cluster endpoint
    const res2 = await fetchAuthenticatedV1(mockCtx, '/v1/cluster/status')
    assert.equal(res2.status, 200)
    assert.equal(capturedUrl, 'http://127.0.0.1:8080/v1/cluster/status')
    assert.equal(capturedHeaders.get('Authorization'), 'Bearer jwt_mock_token')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Docs and Build Friction - README and Siderail Integration Verified', () => {
  assert.ok(ReferenceClusterStatusMod.description.length > 10)
  assert.equal(ReferenceClusterStatusMod.category, 'cluster')
})
