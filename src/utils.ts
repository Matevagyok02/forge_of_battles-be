import { createHash } from 'crypto';

const gameRules = require("../game-rules.json");

//generates a key for joining a games
export const generateKey = (): string => {
    const currentTime = Date.now().toString();

    const randomChars = Array(4)
        .fill('')
        .map(() => gameRules.keyCharacterPool.charAt(Math.floor(Math.random() * gameRules.keyCharacterPool.length)))
        .join('');

    const rawKey = currentTime + randomChars;

    const hash = createHash('sha256').update(rawKey).digest('hex');

    return hash.substring(0, gameRules.joinKeyLength).toUpperCase();
}

//shuffles an array
export const shuffleArray = <T>(array: T[]): T[] => {
    for (let i = array.length - 1; i > 0; i--) {
        // Pick a random index from 0 to i
        const j = Math.floor(Math.random() * (i + 1));

        // Swap array[i] with the element at random index
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

//checks if the database update succeed
export const isUpdateSuccessful = (update: any) => {
    return update.matchedCount > 0 || update.modifiedCount > 0 || update.upsertedCount > 0;
}