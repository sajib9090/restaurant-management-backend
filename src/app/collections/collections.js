import { client } from "../config/db.js";

const db_name = "Restaurant-management";

export const usersCollection = client.db(db_name).collection("users");
export const brandsCollection = client.db(db_name).collection("brands");
export const tablesCollection = client.db(db_name).collection("tables");
export const categoriesCollection = client.db(db_name).collection("categories");
export const menuItemsCollection = client.db(db_name).collection("menu-items");
