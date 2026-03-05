import { app } from './app.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const server = app.listen(PORT, '0.0.0.0', () =>
  console.log(`Server listening on ${PORT}`),
);

// Handle promise rejections outside express (e.g. database connection error)
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION ! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
