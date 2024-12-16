import Redis from "ioredis";

const busyStatusIndicator = "!";
const serviceUri = process.env.FOB_REDIS_URI as string;

const pubRedisClient = new Redis(serviceUri);

const subRedisClient = pubRedisClient.duplicate();

const clear = async () => {
    await pubRedisClient.flushall();
}

pubRedisClient.on('connect', () => {
    clear().then(() => {
        console.log('Redis client connected');
    });
});

pubRedisClient.on('error', () => {
    console.log('Redis client connection failed...');
});

export {
    subRedisClient,
    pubRedisClient,
    busyStatusIndicator
}