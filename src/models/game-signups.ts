import db from "../db";
import { ObjectID } from "mongodb";
import { RSVP, Game } from "./game";
import { Client, User } from "discord.js";
import { ShardGuild } from "../processes/shard-manager";

const connection = db.connection;
const collection = "rsvps";

export interface GameRSVPModel {
  gameId: string | number | ObjectID;
  tag: string;
  id: string;
  timestamp: number;
}

interface GameRSVPDataModel extends GameRSVPModel {
  _id?: string | number | ObjectID;
}

export class GameRSVP implements GameRSVPDataModel {
  _id: string | number | ObjectID;
  gameId: string | number | ObjectID;
  tag: string;
  id: string;
  timestamp: number;

  constructor(rsvp: GameRSVPDataModel | RSVP) {
    Object.entries(rsvp).forEach(([key, value]) => {
      this[key] = value;
    });
  }

  get data(): GameRSVPDataModel {
    return {
      _id: this._id,
      gameId: this.gameId,
      tag: this.tag,
      id: this.id,
      timestamp: this.timestamp
    };
  }

  async save() {
    if (!connection()) throw new Error("No database connection");
    const rsvp: GameRSVPDataModel = this.data;
    delete rsvp._id;
    const col = connection().collection(collection);
    const result = await col.updateOne({ _id: this._id }, { $set: { ...rsvp } }, { upsert: true });
    return result;
  }

  async delete() {
    if (!connection()) throw new Error("No database connection");
    const result = await connection().collection(collection).deleteOne({ _id: new ObjectID(this._id) });
    return result;
  }

  static async fetch(gameId: string | number | ObjectID): Promise<GameRSVP[]> {
    if (!connection()) throw new Error("No database connection");
    const data = await connection().collection(collection).find({ gameId: { $in: [new ObjectID(gameId), gameId] } }).toArray();
    if (data) {
      return data.map(grsvp => new GameRSVP(grsvp));
    }
    else {
      return [];
    }
  }

  static async fetchAllByUser(user: User): Promise<GameRSVP[]> {
    if (!connection()) throw new Error("No database connection");
    const data = await connection().collection(collection).find({ $or: [ { id: user.id }, { tag: user.tag } ] }).toArray();
    if (data) {
      return data.map(grsvp => new GameRSVP(grsvp));
    }
    else {
      return [];
    }
  }

  static async fetchRSVP(gameId: string | number | ObjectID, uid: string): Promise<GameRSVP> {
    if (!connection()) throw new Error("No database connection");
    const query = { gameId: new ObjectID(gameId), $or: [ { id: uid }, { tag: uid } ] };
    const data = await connection().collection(collection).findOne(query);
    if (data) return new GameRSVP(data);
    else return null;
  }

  static async deleteGame(gameId: string | number | ObjectID) {
    if (!connection()) throw new Error("No database connection");
    return await connection().collection(collection).deleteMany({ gameId: { $in: [new ObjectID(gameId), gameId] } });
  }

  static async deleteUser(gameId: string | number | ObjectID, uid: string) {
    if (!connection()) throw new Error("No database connection");
    const query = { gameId: new ObjectID(gameId), $or: [ { id: uid }, { tag: uid } ] };
    return await connection().collection(collection).deleteMany(query);
  }

  static async deleteAllGames(gameIds: (string | number | ObjectID)[]) {
    if (!connection()) throw new Error("No database connection");
    if (gameIds.length === 0) return { deletedCount: 0 };
    return await connection().collection(collection).deleteMany({ gameId: { $in: [ ...gameIds, ...gameIds.map(g => new ObjectID(g)) ] } });
  }
}
