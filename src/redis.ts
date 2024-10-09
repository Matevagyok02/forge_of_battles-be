import Redis from "ioredis";

const busyStatusIndicator = "!";

const pubRedisClient = new Redis({
    password: process.env.FOB_REDIS_PASSWORD,
    host: 'redis-15658.c238.us-central1-2.gce.redns.redis-cloud.com',
    port: 15658
});

const subRedisClient = pubRedisClient.duplicate();

pubRedisClient.on('connect', () => {
    console.log('Redis client connected');
});

pubRedisClient.on('error', () => {
    console.log('Redis client connection failed...');
});

export {
    subRedisClient,
    pubRedisClient,
    busyStatusIndicator
}