const path = require('path');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { connectDB, scheduleReconnect, dbStatus, mongoose } = require('./db');
const Student = require('./models/Student');

const PORT = Number(process.env.PORT || process.env.REGISTRATION_PORT || 5001);
const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(
      `[registration] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt} ms)`
    );
  });
  next();
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ID_RE = /^[A-Za-z0-9_-]{3,30}$/;

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function validateStudent(body) {
  const data = {
    Student_id: clean(body.Student_id),
    Student_name: clean(body.Student_name),
    student_mobile: clean(body.student_mobile),
    student_email: clean(body.student_email)?.toLowerCase(),
    student_password: body.student_password,
  };

  const errors = [];
  if (!data.Student_id) errors.push('Student_id is required');
  else if (!ID_RE.test(data.Student_id)) {
    errors.push('Student_id must be 3-30 letters, numbers, - or _');
  }

  if (!data.Student_name) errors.push('Student_name is required');
  else if (data.Student_name.length < 2) {
    errors.push('Student_name must contain at least 2 characters');
  }

  if (!data.student_mobile) errors.push('student_mobile is required');
  else {
    data.student_mobile = data.student_mobile.replace(/[\s()-]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(data.student_mobile)) {
      errors.push('student_mobile must be 7-15 digits (an optional leading + is allowed)');
    }
  }

  if (!data.student_email) errors.push('student_email is required');
  else if (!EMAIL_RE.test(data.student_email)) errors.push('student_email is not valid');

  if (!data.student_password) errors.push('student_password is required');
  else if (String(data.student_password).length < 6) {
    errors.push('student_password must contain at least 6 characters');
  }

  return { data, errors };
}

function publicStudent(student) {
  return {
    Student_id: student.Student_id,
    Student_name: student.Student_name,
    student_mobile: student.student_mobile,
    student_email: student.student_email,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

// REGISTRATION API (called through the API Gateway as POST /api/students)
app.post('/register', async (req, res, next) => {
  try {
    const { data, errors } = validateStudent(req.body || {});
    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const duplicate = await Student.findOne({
      $or: [{ Student_id: data.Student_id }, { student_email: data.student_email }],
    }).lean();

    if (duplicate) {
      const field =
        duplicate.Student_id === data.Student_id ? 'Student_id' : 'student_email';
      return res.status(409).json({
        message: `A student with this ${field} already exists`,
        field,
      });
    }

    const passwordHash = await bcrypt.hash(String(data.student_password), 10);
    const created = await Student.create({
      Student_id: data.Student_id,
      Student_name: data.Student_name,
      student_mobile: data.student_mobile,
      student_email: data.student_email,
      student_password: passwordHash,
    });

    console.log(`[registration] inserted student ${created.Student_id}`);
    return res.status(201).json({
      message: 'Student registered successfully',
      student: publicStudent(created),
    });
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || 'field';
      return res.status(409).json({
        message: `A student with this ${field} already exists`,
        field,
      });
    }
    return next(error);
  }
});

app.get('/health', (req, res) => {
  const database = dbStatus();
  res.status(database.ready ? 200 : 503).json({
    status: database.ready ? 'ok' : 'degraded',
    service: 'registration-service',
    database,
  });
});

app.get('/', (req, res) => {
  res.json({ service: 'registration-service', endpoint: 'POST /register' });
});

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Request body must be valid JSON' });
  }
  console.error('[registration] unhandled error:', error);
  return res.status(500).json({ message: 'Internal server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[registration] Registration Microservice listening on port ${PORT}`);
});

connectDB()
  .then(async () => {
    // Make sure the unique indexes on Student_id and student_email exist in Atlas.
    await Student.init();
    console.log('[registration] unique indexes are ready');
  })
  .catch((error) => {
    console.error('[registration] initial MongoDB connection failed:', error.message);
    scheduleReconnect();
  });

mongoose.connection.on('disconnected', () => {
  console.warn('[registration] MongoDB disconnected');
  scheduleReconnect();
});

function shutdown(signal) {
  console.log(`[registration] ${signal} received, shutting down`);
  server.close(async () => {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
