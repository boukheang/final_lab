// Quick database inspection for local verification (not part of the deployed app).
// Run from registration-service: node ..\database\inspect.js
const path = require('path');
const mongoose = require(path.resolve(__dirname, '..', 'registration-service', 'node_modules', 'mongoose'));

require(path.resolve(__dirname, '..', 'registration-service', 'node_modules', 'dotenv')).config({
  path: path.resolve(__dirname, '..', '.env'),
});

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'CLD_Final',
  });
  const collection = mongoose.connection.collection('students');
  const documents = await collection.find({}).toArray();
  console.log(`database: ${mongoose.connection.name}`);
  console.log(`documents: ${documents.length}`);
  console.log(JSON.stringify(documents, null, 2));
  console.log('indexes:');
  console.log(JSON.stringify(await collection.indexes(), null, 2));
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
