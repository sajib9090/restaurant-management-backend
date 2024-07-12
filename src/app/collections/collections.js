import { client } from "../config/db.js";

const db_name = "Restaurant-management";

export const usersCollection = client.db(db_name).collection("users");
export const brandsCollection = client.db(db_name).collection("brands");
export const tablesCollection = client.db(db_name).collection("tables");
export const categoriesCollection = client.db(db_name).collection("categories");
export const menuItemsCollection = client.db(db_name).collection("menu-items");
export const membersCollection = client.db(db_name).collection("members");
export const staffsCollection = client.db(db_name).collection("staffs");
export const plansCollection = client.db(db_name).collection("plans");
export const planPurchaseCollection = client
  .db(db_name)
  .collection("plan-purchase");
export const soldInvoiceCollection = client
  .db(db_name)
  .collection("sold-invoices");
export const removedUsersCollection = client
  .db(db_name)
  .collection("removed-users");
