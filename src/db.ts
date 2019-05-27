import mongodb from "mongodb";

let _db: mongodb.Db;

class database {
    client = mongodb.MongoClient;
    connected = false;

    async connect() {
        let result: mongodb.MongoClient;
        try {
            result = await this.client.connect(process.env.MONGODB_URL, { useNewUrlParser: true });
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

export = {
    database: new database(),
    connection: () => {
        return _db;
    }
};
