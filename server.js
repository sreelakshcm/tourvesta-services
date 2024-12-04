/* eslint-disable no-console */
import mongoose from 'mongoose';
import app from './app.js';
process.on('uncaughtException', (err) => {
  console.log(err.name, err.message);
  console.log('Uncaught Exception! 💥 Shutting Down...');
  process.exit(1);
});

const DB_URI = process.env.DATABASE.replace(
  '<DATABASE_PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose.connect(DB_URI).then(() => console.log('DB Connection Successful!'));

const port = process.env.PORT || 8000;

const server = app.listen(port, () => {
  console.log(`Server running on ${port}`);
});

process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  console.log('Unhandled Rejection! 💥 Shutting Down...');
  server.close(() => {
    process.exit(1);
  });
});
