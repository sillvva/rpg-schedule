const mongodb = require('mongodb');

let _db;

class database {
    constructor() {
        this.client = mongodb.MongoClient;
        this.connected = false;
    }

    async connect() {
        let result = false;
        try {
            result = await this.client.connect(
                process.env.MONGODB_URL,
                { useNewUrlParser: true }
            )
        } catch (err) {
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

exports.db = new database();
exports.connection = () => { return _db };