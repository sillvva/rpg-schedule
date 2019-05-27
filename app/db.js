"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const mongodb_1 = __importDefault(require("mongodb"));
let _db;
class database {
    constructor() {
        this.client = mongodb_1.default.MongoClient;
        this.connected = false;
    }
    async connect() {
        let result;
        try {
            result = await this.client.connect(process.env.MONGODB_URL, { useNewUrlParser: true });
        }
        catch (err) {
            console.log(err);
        }
        if (result) {
            this.connected = true;
            _db = result.db();
            return true;
        }
        return false;
    }
}
module.exports = {
    database: new database(),
    connection: () => {
        return _db;
    }
};
