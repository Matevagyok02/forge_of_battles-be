import Redis from "ioredis";

let connected = false;
const busyStatusIndicator = "!";
const serviceUri = process.env.FOB_REDIS_URI as string;

const pubRedisClient = new Redis(serviceUri);

const subRedisClient = pubRedisClient.duplicate();

const clear = async () => {
    const keyRegex = /^[A-Z0-9]{6}$/;
    const allKeys = await pubRedisClient.keys("*");

    const keysToDelete = allKeys.filter(key => !key.match(keyRegex));

    if (keysToDelete.length > 0) {
        await pubRedisClient.del(...keysToDelete);
    }
}

pubRedisClient.on('connect', () => {
    if (!connected) {
        connected = true;
        clear().then(() => {
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