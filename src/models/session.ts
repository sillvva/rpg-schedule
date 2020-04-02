import db from "../db";
import { ObjectID, ObjectId, DeleteWriteOpResultObject } from "mongodb";

const connection = db.connection;
const collection = "sessions";

export interface SessionModel {
  expires: Date;
  token: String;
  session: {
    api: {
      lastRefreshed: Number;
      access: {
        access_token: String;
        expires_in: Number;
        refresh_token: String;
        scope: String;
        token_type: String;
      };
    };
  };
}

interface SessionDataModel extends SessionModel {
  _id?: string | number | ObjectID;
}

export class Session implements SessionDataModel {
  _id: string | number | ObjectID;
  expires: Date = new Date();
  token: String = "";
  session = {
    api: {
      lastRefreshed: 0,
      access: {
        access_token: "",
        expires_in: 604800,
        refresh_token: "",
        scope: "identify guilds",
        token_type: "Bearer"
      }
    }
  };

  constructor(session: SessionDataModel) {
    if (!session._id) this._id = new ObjectId();
    Object.entries(session).forEach(([key, value]) => {
      this[key] = value;
    });
  }

  get data(): SessionDataModel {
    return {
      _id: this._id,
      expires: this.expires,
      token: this.token,
      session: this.session
    };
  }

  async save() {
    if (!connection()) throw new Error("No database connection");
    const config: SessionDataModel = this.data;
    const col = connection().collection(collection);
    return await col.updateOne({ _id: this._id }, { $set: { ...config } }, { upsert: true });
  }

  async delete(): Promise<DeleteWriteOpResultObject> {
    if (!connection()) throw new Error("No database connection");
    return await connection()
      .collection(collection)
      .deleteOne({ _id: new ObjectID(this._id) });
  }

  static async fetch(token: string): Promise<Session> {
    if (!connection()) throw new Error("No database connection");
    const data = await connection()
      .collection(collection)
      .findOne({ token: token });
    if (data) return new Session(data);
    else return null;
  }
}
