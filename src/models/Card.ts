import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema({
    name: { type: String, required: true },
    attack: { type: Number, required: true },
    defense: { type: Number, required: true },
    description: { type: String, required: false }
});

// Create a Mongoose model for the 'Card' collection
const Card = mongoose.model('cards', cardSchema);

export default Card;
