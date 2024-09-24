import express from "express";
import http from "http";
import cors from "cors";
import WebSocket from "ws";
import "./database";
import router from "./routes";
import {auth} from "express-oauth2-jwt-bearer";

const authConfig = require("../auth.config.json");
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

app.use(express.json());
app.use('/', router);

const port = 3000;

const jwtCheck = auth(authConfig);

// enforce on all endpoints
app.use(jwtCheck);

app.get('/authorized', function (req, res) {
    res.send('Secured Resource');
});

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

server.listen(port, () => {
    console.log(`The server is LIVE`);
})