import express from "express";
import cors from "cors";
import Card from "./models/Card"
import "./database";
import mongoose from "mongoose";

const app = express();

app.use(cors({
   origin: [
       'http://localhost:5173',
       'https://localhost:5173',
       'https://forge-of-battles-fe.onrender.com'
   ],
   methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

const port = 3000;

app.get('/:id', async (req, res) => {
    try {
        // Get the 'id' parameter from the URL
        const cardId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(cardId)) {
            return res.status(400).send({ message: 'Invalid card ID format' });
        }

        const card = await Card.findById(new mongoose.Types.ObjectId(cardId));

        if (!card) {
            // If no card is found, send a 404 response
            return res.status(404).send({message: 'Card not found'});
        }
        // Send the card data as a response
        res.json(card);
    } catch (err) {
        console.error('Error fetching card:', err);
        // Send a 500 response if an error occurs
        res.status(500).send({message: 'Server error'});
    }
});

// Start the server and listen on the specified port
app.listen(port, () => {
    // Log a message when the server is successfully running
    console.log(`Server is running on http://localhost:${port}`);
});