const path = require('path');
const express = require('express');
const cors = require('cors');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { connectDB, scheduleReconnect, dbStatus, mongoose } = require('./db');
const Student = require('./models/Student');

const PORT = Number(process.env.PORT || process.env.DELETE_PORT || 5002);
const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(
      `[delete-student] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt} ms)`
    );
  });
  next();
});

// DELETE API (called through the API Gateway as DELETE /api/students/:student_id)
app.delete('/students/:student_id', async (req, res, next) => {
  try {
    const studentId = String(req.params.student_id || '').trim();
    if (!studentId) {
      return res.status(400).json({ message: 'student_id is required' });
    }

    const deleted = await Student.findOneAndDelete({ Student_id: studentId }).lean();

    if (!deleted) {
      return res.status(404).json({
        message: `Student with Student_id "${studentId}" was not found`,
        Student_id: studentId,
      });
    }

    console.log(`[delete-student] deleted student ${deleted.Student_id}`);

    return res.status(200).json({
      message: 'Student deleted successfully',
      student: {
        Student_id: deleted.Student_id,
        Student_name: deleted.Student_name,
        student_mobile: deleted.student_mobile,
        student_email: deleted.student_email,
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/health', (req, res) => {
  const database = dbStatus();
  res.status(database.ready ? 200 : 503).json({
    status: database.ready ? 'ok' : 'degraded',
    service: 'delete-student-service',
    database,
  });
});

app.get('/', (req, res) => {
  res.json({
    service: 'delete-student-service',
    endpoint: 'DELETE /students/:student_id',
  });
});

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Request body must be valid JSON' });
  }
  console.error('[delete-student] unhandled error:', error);
  return res.status(500).json({ message: 'Internal server error' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[delete-student] Delete Student Microservice listening on port ${PORT}`);
});

connectDB().catch((error) => {
  console.error('[delete-student] initial MongoDB connection failed:', error.message);
  scheduleReconnect();
});

mongoose.connection.on('disconnected', () => {
  console.warn('[delete-student] MongoDB disconnected');
  scheduleReconnect();
});

function shutdown(signal) {
  console.log(`[delete-student] ${signal} received, shutting down`);
  server.close(async () => {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
