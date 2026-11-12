const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Student = require('./models/Student');

(async () => {
  console.log('mongoose', mongoose.version);
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'CLD_Final' });
  console.log('readyState', mongoose.connection.readyState);
  console.log('db?', Boolean(mongoose.connection.db));
  console.log('model db?', Boolean(Student.db));
  try {
    await Student.init();
    console.log('init ok');
  } catch (error) {
    console.error('init failed:', error.stack);
  }
  console.log('indexes', await mongoose.connection.collection('students').indexes());
  await mongoose.disconnect();
})();
