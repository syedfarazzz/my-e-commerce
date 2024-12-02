const mongoose = require("mongoose");
const retry = require('retry');

const connectDb = async () => {
  const operation = retry.operation({ retries: 5, factor: 2, minTimeout: 1000 });

  operation.attempt(async (currentAttempt) => {
    try {
      // Check if there is an existing connection
      if (mongoose.connection.readyState === 1) {
        console.log('MongoDB is already connected');
        return;
      }

      // Attempt to connect to MongoDB
      await mongoose.connect(process.env.DB_REMOTE, {
        // useNewUrlParser: true,
        // useUnifiedTopology: true,
        // useFindAndModify: false,
        // useCreateIndex: true
      });

      console.log('MongoDB Connected Successfully');
    } catch (error) {
      console.error(`Error during connection attempt: ${error.message}`);
      if (operation.retry(error)) {
        console.log(`Retry attempt ${currentAttempt}: Connection error`);
        return;
      }

      console.error('Connection failed after multiple attempts');
      process.exit(1);
    }

  });
}

module.exports = connectDb;