import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5600').replace(/\/$/, '');
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL;
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD;
const PLATFORM = __ENV.PLATFORM || 'nivapp';
const PROFILE = __ENV.PROFILE || 'smoke';
const THINK_TIME_SECONDS = Number(__ENV.THINK_TIME_SECONDS || 1);

const MAX_ERROR_RATE = Number(__ENV.MAX_ERROR_RATE || 0.01);
const P95_LIMIT_MS = Number(__ENV.P95_LIMIT_MS || 1500);
const P99_LIMIT_MS = Number(__ENV.P99_LIMIT_MS || 3000);

const profiles = {
  smoke: [
    { duration: '10s', target: 1 },
    { duration: '20s', target: 1 },
    { duration: '10s', target: 0 },
  ],
  load: [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 20 },
    { duration: '2m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  stress: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 30 },
    { duration: '1m', target: 60 },
    { duration: '1m', target: 90 },
    { duration: '30s', target: 0 },
  ],
};

const selectedStages = profiles[PROFILE];

if (!selectedStages) {
  throw new Error(`Unknown PROFILE "${PROFILE}". Use smoke, load, or stress.`);
}

export const options = {
  scenarios: {
    admin_backend_flow: {
      executor: 'ramping-vus',
      exec: 'adminBackendFlow',
      startVUs: 0,
      gracefulRampDown: '15s',
      stages: selectedStages,
      tags: { surface: 'admin', flow: 'login_dashboard' },
    },
  },
  summaryTrendStats: [
    'avg',
    'min',
    'med',
    'p(65)',
    'p(90)',
    'p(95)',
    'p(99)',
    'max',
  ],
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: [`rate<${MAX_ERROR_RATE}`],
    http_req_duration: [
      `p(95)<${P95_LIMIT_MS}`,
      `p(99)<${P99_LIMIT_MS}`,
    ],
    'http_req_duration{operation:admin_login}': [
      `p(95)<${P95_LIMIT_MS}`,
      `p(99)<${P99_LIMIT_MS}`,
    ],
    'http_req_duration{operation:dashboard_category_counts}': [
      `p(95)<${P95_LIMIT_MS}`,
      `p(99)<${P99_LIMIT_MS}`,
    ],
    'http_req_duration{operation:dashboard_orders}': [
      `p(95)<${P95_LIMIT_MS}`,
      `p(99)<${P99_LIMIT_MS}`,
    ],
    'http_req_duration{operation:dashboard_inventory_health}': [
      `p(95)<${P95_LIMIT_MS}`,
      `p(99)<${P99_LIMIT_MS}`,
    ],
    admin_api_error_rate: [`rate<${MAX_ERROR_RATE}`],
    admin_flow_error_rate: [`rate<${MAX_ERROR_RATE}`],
    admin_login_duration: [`p(95)<${P95_LIMIT_MS}`],
    admin_dashboard_duration: [
      `p(95)<${P95_LIMIT_MS}`,
      `p(99)<${P99_LIMIT_MS}`,
    ],
  },
};

const adminApiRequests = new Counter('admin_api_requests');
const adminApiFailures = new Counter('admin_api_failures');
const adminApiErrorRate = new Rate('admin_api_error_rate');
const adminFlowErrorRate = new Rate('admin_flow_error_rate');
const loginDuration = new Trend('admin_login_duration', true);
const dashboardDuration = new Trend('admin_dashboard_duration', true);

function parseJson(response) {
  try {
    return response.json();
  } catch (_) {
    return null;
  }
}

function recordRequest(response, passed, durationMetric) {
  adminApiRequests.add(1);
  adminApiErrorRate.add(!passed);

  if (durationMetric) {
    durationMetric.add(response.timings.duration);
  }

  if (!passed) {
    adminApiFailures.add(1);
  }
}

function authenticate() {
  const response = http.post(
    `${BASE_URL}/v1/auth/signin`,
    JSON.stringify({
      useremail: ADMIN_EMAIL,
      userpassword: ADMIN_PASSWORD,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { operation: 'admin_login', name: 'POST /v1/auth/signin' },
      timeout: '30s',
    },
  );

  const body = parseJson(response);
  const passed = check(response, {
    'admin login returns 200': (res) => res.status === 200,
    'admin login succeeds': () => body?.success === true,
    'admin login returns access token': () => typeof body?.data?.token === 'string',
  });

  recordRequest(response, passed, loginDuration);

  return passed ? body.data.token : null;
}

function loadDashboard(token) {
  const params = {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: '30s',
  };

  const startedAt = Date.now();
  const responses = http.batch([
    [
      'GET',
      `${BASE_URL}/v1/products/platform/${encodeURIComponent(PLATFORM)}/counts`,
      null,
      {
        ...params,
        tags: {
          operation: 'dashboard_category_counts',
          name: 'GET /v1/products/platform/:platform/counts',
        },
      },
    ],
    [
      'GET',
      `${BASE_URL}/v1/analytics/orders`,
      null,
      {
        ...params,
        tags: {
          operation: 'dashboard_orders',
          name: 'GET /v1/analytics/orders',
        },
      },
    ],
    [
      'GET',
      `${BASE_URL}/v1/analytics/inventory-health?platform=${encodeURIComponent(PLATFORM)}`,
      null,
      {
        ...params,
        tags: {
          operation: 'dashboard_inventory_health',
          name: 'GET /v1/analytics/inventory-health',
        },
      },
    ],
  ]);

  dashboardDuration.add(Date.now() - startedAt);

  const [categoryResponse, ordersResponse, inventoryResponse] = responses;
  const categoryBody = parseJson(categoryResponse);
  const ordersBody = parseJson(ordersResponse);
  const inventoryBody = parseJson(inventoryResponse);

  const categoryPassed = check(categoryResponse, {
    'category dashboard returns 200': (res) => res.status === 200,
    'category dashboard has categories': () =>
      categoryBody?.success === true && Array.isArray(categoryBody?.data?.categories),
  });
  recordRequest(categoryResponse, categoryPassed);

  const ordersPassed = check(ordersResponse, {
    'orders dashboard returns 200': (res) => res.status === 200,
    'orders dashboard has overview': () =>
      ordersBody?.success === true && typeof ordersBody?.data?.overview === 'object',
  });
  recordRequest(ordersResponse, ordersPassed);

  const inventoryPassed = check(inventoryResponse, {
    'inventory dashboard returns 200': (res) => res.status === 200,
    'inventory dashboard has numeric totals': () =>
      inventoryBody?.success === true &&
      typeof inventoryBody?.data?.totalProducts === 'number' &&
      typeof inventoryBody?.data?.totalStockItems === 'number',
  });
  recordRequest(inventoryResponse, inventoryPassed);

  return categoryPassed && ordersPassed && inventoryPassed;
}

export function setup() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD are required. Use a dedicated non-production Admin test account.',
    );
  }

  return { configured: true };
}

export function adminBackendFlow() {
  let flowPassed = false;

  group('Admin login and dashboard', () => {
    const token = authenticate();

    if (token) {
      flowPassed = loadDashboard(token);
    }
  });

  adminFlowErrorRate.add(!flowPassed);
  sleep(THINK_TIME_SECONDS);
}
