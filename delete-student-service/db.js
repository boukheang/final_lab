const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

mongoose.set('bufferCommands', false);
mongoose.set('strictQuery', true);

const MONGODB_DB = process.env.MONGODB_DB || 'CLD_Final';
let reconnectTimer = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env first.');
  }

  await mongoose.connect(uri, {
    dbName: MONGODB_DB,
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });

  console.log(`[delete-student] connected to MongoDB database "${mongoose.connection.name}"`);
  return mongoose.connection;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      await connectDB();
    } catch (error) {
      console.error('[delete-student] MongoDB reconnect failed:', error.message);
      scheduleReconnect();
    }
  }, 5000);
  reconnectTimer.unref?.();
}

function dbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    database: mongoose.connection.name || MONGODB_DB,
    ready: mongoose.connection.readyState === 1,
  };
}

module.exports = { connectDB, scheduleReconnect, dbStatus, mongoose, MONGODB_DB };
