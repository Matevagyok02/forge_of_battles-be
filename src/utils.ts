import { createHash } from 'crypto';

const CHAR_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

//generates a key for joining a games
const generateKey = (length: number): string => {
    const currentTime = Date.now().toString();

    const randomChars = Array(4)
        .fill('')
        .map(() => CHAR_POOL.charAt(Math.floor(Math.random() * CHAR_POOL.length)))
        .join('');

    const rawKey = currentTime + randomChars;

    const hash = createHash('sha256').update(rawKey).digest('hex');

    return hash.substring(0, length).toUpperCase();
}

//shuffles an array
const shuffleArray = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        // Pick a random index from 0 to i
        const j = Math.floor(Math.random() * (i + 1));

        // Swap array[i] with the element at random index
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}