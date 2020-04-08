import db from "../db";
import { ObjectID, ObjectId } from "mongodb";

const connection = db.connection;
const collection = "users";

export interface UserModel {
  lang?: string;
}

interface UserDataModel extends UserModel {
  _id?: string | number | ObjectID;
  id: string;
}

export class User implements UserDataModel {
  _id: string | number | ObjectID;
  id: string;
  lang: string = 'en';

  constructor(session: UserDataModel) {
    Object.entries(session).forEach(([key, value]) => {
      this[key] = value;
    });
  }

  get data(): UserDataModel {
    return {
      _id: this._id,
      id: this.id,
      lang: this.lang
    };
  }

  async save() {
    if (!connection()) throw new Error("No database connection");
    const user: UserModel = this.data;
    const col = connection().collection(collection);
    return await col.updateOne({ id: this.id }, { $set: { ...user } }, { upsert: true });
  }

  static async fetch(id: string): Promise<User> {
    if (!connection()) throw new Error("No database connection");
    const data = await connection()
      .collection(collection)
      .findOne({ id: id });
    if (data) return new User(data);
    else {
      const user = new User({ _id: new ObjectId(), id: id });
      await user.save();
      return user;
    };
  }
}
