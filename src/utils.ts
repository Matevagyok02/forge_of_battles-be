import { createHash } from 'crypto';

const CHAR_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

//generates a key for joining a games
function generateKey(length: number): string {
    const currentTime = Date.now().toString();

    const randomChars = Array(4)
        .fill('')
        .map(() => CHAR_POOL.charAt(Math.floor(Math.random() * CHAR_POOL.length)))
        .join('');

    const rawKey = currentTime + randomChars;

    const hash = createHash('sha256').update(rawKey).digest('hex');

    return hash.substring(0, length).toUpperCase();
}

