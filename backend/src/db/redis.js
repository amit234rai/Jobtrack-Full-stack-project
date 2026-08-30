import Redis from "ioredis";
import { env } from "../config/env.js";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  connectTimeout: 5_000,
  lazyConnect: true,
});

redis.on("error", (error) => {
  console.error("Redis error:", error.message);
});

export async function cached(key, ttlSeconds, load) {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
  } catch (error) {
    console.error(`Cache read failed for ${key}:`, error.message);
  }

  const value = await load();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    console.error(`Cache write failed for ${key}:`, error.message);
  }

  return value;
}

export async function invalidateDashboard(userId) {
  try {
    await redis.del(`dashboard:${userId}`);
  } catch (error) {
    console.error(`Failed to invalidate dashboard cache for ${userId}:`, error.message);
  }
}

export const closeRedis = () => redis.quit();
