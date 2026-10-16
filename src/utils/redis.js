
import Redis from "ioredis";

if (!process.env.REDIS_PASSWORD) {
  throw new Error("REDIS_PASSWORD is missing");
}

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD,

  lazyConnect: true,

  maxRetriesPerRequest: 1,

  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

redis.on("connect", () => {
  console.log("Redis TCP connection established");
});

redis.on("ready", () => {
  console.log("Redis is ready");
});

redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});

export const connectRedis = async () => {
  try {
    if (redis.status === "wait") {
      await redis.connect();
    }

    const response = await redis.ping();
    console.log("Redis health check:", response);
  } catch (error) {
    console.error("Redis connection failed:", error.message);
    throw error;
  }
};

export default redis;