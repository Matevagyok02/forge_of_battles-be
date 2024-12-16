import {MatchModel} from "./models/Match";
import mongoose from "mongoose";

class Mongo {

    readonly uri = process.env.FOB_MONGO_URI;
    readonly inactivityTime = require("../game-rules.json").inactivityTime * 60; //inactivity time converted to seconds

    constructor() {
        this.connect();
    }

    private createIndex() {
        MatchModel.collection.createIndex(
            { updatedAt: 1 },
            { expireAfterSeconds: this.inactivityTime })
            .then(() => console.log('Mongo index created'))
            .catch(() => console.error('Mongo index creation failed'));
    }

    connect() {
        if (this.uri) {
            mongoose
                .connect(this.uri)
                .then(() => {
                    console.log('MongoDB connected');
                    this.createIndex();
                })
                .catch(() => {
                    console.error('MongoDB connection failed...');
                });
        } else {
            console.log("Missing environment variable: 'FOB_MONGO_URI'");
        }
    }
}

export default Mongo;