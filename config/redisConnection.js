const redis = require("redis");
const retry = require("retry");

const client = redis.createClient({
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }
});

const connectRedis = async () => {
    const operation = retry.operation({ retries: 5, factor: 2, minTimeout: 1000 });

    operation.attempt(async (currentAttempt) => {
        try {
            // Attempt to connect to Redis
            await client.connect();
            console.log("Redis Client Connected");

            // Handle connection success
            client.on("ready", () => {
                console.log("Redis is ready to use");
            });

            // Set event listener for disconnects and attempt reconnection
            client.on("end", () => {
                console.log("Redis connection closed. Attempting to reconnect...");
                connectRedis();
            });

        } catch (error) {
            console.error(`Error during Redis connection attempt: ${error.message}`);
            if (operation.retry(error)) {
                console.log(`Retry attempt ${currentAttempt}: Redis connection error`);
                return;
            }

            console.error("Redis connection failed after multiple attempts");
            process.exit(1); // exit if unable to connect after retries
        }
    });
};

// Graceful shutdown for Redis connection
process.on("SIGINT", async () => {
    try {
        await client.quit();
        console.log("Redis client disconnected");
    } catch (err) {
        console.error("Error during Redis shutdown:", err);
    } finally {
        process.exit(0);
    }
});

// Event listener for errors after connection
client.on("error", (err) => {
    try {
        console.error("Redis Client Error:", err);
    } catch (e) {
        console.error("Unexpected error in Redis error handler:", e);
    }
});


module.exports = { connectRedis, client };
