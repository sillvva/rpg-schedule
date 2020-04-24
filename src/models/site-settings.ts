import db from "../db";

const connection = db.connection;
const collection = "siteSettings";

interface Credit {
  type: string;
  name: string;
}

export interface SiteSettingModel {
  site: string;
  maintenanceTime: number;
  maintenanceDuration: number;
  credits: Credit[]
}

export class SiteSettings implements SiteSettingModel {
  site: string = process.env.SITE;
  maintenanceTime: number = 0;
  maintenanceDuration: number = 0;
  credits: Credit[] = [];

  constructor(session: SiteSettingModel) {
    Object.entries(session).forEach(([key, value]) => {
      this[key] = value;
    });
    
    // Strip HTML Tags from Data
    for (let i in this.data) {
      if (typeof this[i] === "string") {
        this[i] = this[i].replace(/<\/?(\w+)((\s+\w+(\s*=\s*(?:".*?"|'.*?'|[\^'">\s]+))?)+\s*|\s*)\/?>/gm, "");
      }
    }
  }

  get data(): SiteSettingModel {
    return {
      site: this.site,
      maintenanceTime: this.maintenanceTime,
      maintenanceDuration: this.maintenanceDuration,
      credits: this.credits
    };
  }

  async save() {
    if (!connection()) throw new Error("No database connection");
    const config: SiteSettingModel = this.data;
    const col = connection().collection(collection);
    return await col.updateOne({ site: this.site }, { $set: { ...config } }, { upsert: true });
  }

  static async fetch(site: string): Promise<SiteSettings> {
    if (!connection()) throw new Error("No database connection");
    const data = await connection()
      .collection(collection)
      .findOne({ site: site });
    if (data) return new SiteSettings(data);
    else {
      const siteSettings = new SiteSettings({ site: process.env.SITE, maintenanceTime: 0, maintenanceDuration: 0, credits: [] });
      await siteSettings.save();
      return siteSettings;
    };
  }
}
