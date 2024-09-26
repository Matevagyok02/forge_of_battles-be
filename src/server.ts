import express from "express";
import http from "http";
import cors from "cors";
import WebSocket from "ws";
import "./database";
import router from "./routes";
import {auth} from "express-oauth2-jwt-bearer";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

//CORS configuration
app.use(express.json());
app.use(cors(require("../cors.config.json")));
app.use(auth(require("../auth.config.json")));
app.use('/', router);

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

server.listen(port, () => {
    console.log(`The server is LIVE`);
})