import Redis from "ioredis";

let connected = false;
const busyStatusIndicator = "!";
const serviceUri = process.env.FOB_REDIS_URI as string;

const pubRedisClient = new Redis(serviceUri);

const subRedisClient = pubRedisClient.duplicate();

const clear = async () => {
    await pubRedisClient.flushall();
}

pubRedisClient.on('connect', () => {
    if (!connected) {
        clear().then(() => {
            connected = true;
            console.log('Redis client connected')
        })
    }
});

pubRedisClient.on('error', () => {
    console.log('Redis client connection failed...');
});

export {
    subRedisClient,
    pubRedisClient,
    busyStatusIndicator
}