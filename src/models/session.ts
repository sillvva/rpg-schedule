import db from "../db";
import { ObjectID, ObjectId, DeleteWriteOpResultObject } from "mongodb";
import config from "./config";

const connection = db.connection;
const collection = "sessions";

export interface SessionModel {
  expires: Date;
  token: string;
  version?: number;
  session: {
    api: {
      lastRefreshed: number;
      access: {
        access_token: string;
        expires_in: number;
        refresh_token: string;
        scope: string;
        token_type: string;
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
  token: string = "";
  version: number = config.sessionVersion;
  session = {
    api: {
      lastRefreshed: 0,
      access: {
        access_token: "",
        expires_in: 604800,
        refresh_token: "",
        scope: "identify guilds",
        token_type: "Bearer",
      },
    },
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
      version: this.version,
      session: this.session,
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
    const data = await connection().collection(collection).findOne({ token: token, version: config.sessionVersion });
    if (data) return new Session(data);
    else return null;
  }
}
