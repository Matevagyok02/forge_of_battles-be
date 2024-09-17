import express from "express";
import http from "http";
import cors from "cors";
import WebSocket from "ws";
//import "./database";
import Card from "./models/Card";
import mongoose from "mongoose";
import fs from "fs";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

//CORS configuration
app.use(cors({
   origin: [
       'http://localhost:5173',
       'https://localhost:5173',
       'https://forge-of-battles-fe.onrender.com'
   ],
   methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

const port = 3000;

const connectedClients: Set<WebSocket> = new Set();

wss.on('connection', (ws: WebSocket) => {
    console.log('A new client connected.');
    connectedClients.add(ws);

    // Handle incoming messages from clients
    ws.on('message', (message: WebSocket.MessageEvent) => {
        const data = JSON.parse(message.toString());
        const { action, userId, messageText } = data;

        if (action === 'send_message') {
            // Broadcast message to all connected clients
            connectedClients.forEach(client => {
                if (client !== ws) { // Avoid sending the message back to the sender
                    client.send(JSON.stringify({
                        action: 'receive_message',
                        from: userId,
                        messageText: messageText
                    }));
                }
            });
        }
    });

    // Handle disconnection
    ws.on('close', () => {
        console.log('A client disconnected');
        connectedClients.delete(ws);
    });
});

app.get('/test', async (req, res) => {
    return res.send({message: 'it works!'});
})

// app.get('/:id', async (req, res) => {
//     try {
//         // Get the 'id' parameter from the URL
//         const cardId = req.params.id;
//
//         if (!mongoose.Types.ObjectId.isValid(cardId)) {
//             return res.status(400).send({ message: 'Invalid card ID format' });
//         }
//
//         const card = await Card.findById(new mongoose.Types.ObjectId(cardId));
//
//         if (!card) {
//             // If no card is found, send a 404 response
//             return res.status(404).send({message: 'Card not found'});
//         }
//         // Send the card data as a response
//         res.json(card);
//     } catch (err) {
//         console.error('Error fetching card:', err);
//         // Send a 500 response if an error occurs
//         res.status(500).send({message: 'Server error'});
//     }
// });

// Start the server and listen on the specified port

server.listen(port, () => {
    console.log(`The WebSocket server is LIVE`);
})