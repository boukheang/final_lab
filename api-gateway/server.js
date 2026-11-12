const path = require('path');
const express = require('express');
const cors = require('cors');
const httpProxy = require('http-proxy');

// Local runs load the project-level .env. Docker/Kubernetes supply env vars.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const PORT = Number(process.env.PORT || process.env.GATEWAY_PORT || 4000);
const REGISTRATION_URL = process.env.REGISTRATION_URL || 'http://127.0.0.1:5001';
const DELETE_SERVICE_URL = process.env.DELETE_SERVICE_URL || 'http://127.0.0.1:5002';

const app = express();
app.disable('x-powered-by');
app.use(cors());
// Do not add express.json() here: the raw request body must stay unread so it
// can be streamed unchanged to the registration microservice by http-proxy.

// Request log: every public call is visible at the gateway.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(
      `[gateway] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt} ms)`
    );
  });
  next();
});

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true,
  proxyTimeout: 20000,
  timeout: 20000,
});

proxy.on('error', (err, req, res) => {
  console.error(`[gateway] proxy error for ${req.method} ${req.originalUrl}:`, err.message);
  if (!res.headersSent) {
    res.status(502).json({
      message: 'Bad Gateway: the target microservice is unavailable.',
      detail: err.message,
    });
  } else {
    res.destroy(err);
  }
});

function forward(req, res, target, upstreamPath) {
  req.url = upstreamPath;
  proxy.web(req, res, { target });
}

// Public API -> Registration microservice (Pod 1, port 5001)
app.post('/api/students', (req, res) => {
  forward(req, res, REGISTRATION_URL, '/register');
});

// Public API -> Delete Student microservice (Pod 2, port 5002)
app.delete('/api/students/:student_id', (req, res) => {
  const studentId = encodeURIComponent(req.params.student_id);
  forward(req, res, DELETE_SERVICE_URL, `/students/${studentId}`);
});

// Gateway-level liveness/readiness. It also probes both upstreams.
app.get('/health', async (req, res) => {
  const check = async (name, target) => {
    try {
      const response = await fetch(`${target}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return { name, ok: response.ok, status: response.status };
    } catch (error) {
      return { name, ok: false, error: error.message };
    }
  };

  const upstreams = await Promise.all([
    check('registration-service', REGISTRATION_URL),
    check('delete-student-service', DELETE_SERVICE_URL),
  ]);
  const ok = upstreams.every((item) => item.ok);

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    service: 'api-gateway',
    port: PORT,
    upstreams,
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'CLD Final API Gateway',
    routes: [
      'POST /api/students',
      'DELETE /api/students/:student_id',
      'GET /health',
    ],
    registrationUrl: REGISTRATION_URL,
    deleteServiceUrl: DELETE_SERVICE_URL,
  });
});

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[gateway] API Gateway listening on port ${PORT}`);
  console.log(`[gateway] registration -> ${REGISTRATION_URL}`);
  console.log(`[gateway] delete       -> ${DELETE_SERVICE_URL}`);
});

function shutdown(signal) {
  console.log(`[gateway] ${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
