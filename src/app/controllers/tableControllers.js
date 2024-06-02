import createError from "http-errors";
import { ObjectId } from "mongodb";
import { tablesCollection } from "../collections/collections.js";
import { validateString } from "../helpers/validateString.js";
import slugify from "slugify";
import validator from "validator";
import { requiredField } from "../helpers/requiredField.js";

export const handleCreateTable = async (req, res, next) => {
  const { table_name } = req.body;
  const user = req.user;
  try {
    requiredField(table_name, "Table Name is required");
    const processedTableName = validateString(table_name, "Table Name", 2, 30);

    const existingTable = await tablesCollection.findOne({
      $and: [{ table_name: processedTableName }, { brand: user?.brand_id }],
    });

    if (existingTable) {
      throw createError(400, "Table name already exists");
    }

    const tableSlug = slugify(processedTableName);
    const newTable = {
      table_name: processedTableName,
      table_slug: tableSlug,
      brand: user?.brand_id,
      createdBy: user?.user_id,
      createdAt: new Date(),
    };

    const table = await tablesCollection.insertOne(newTable);
    console.log(table);

    res.status(200).send({
      success: true,
      message: "New table created",
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetTables = async (req, res, next) => {
  const user = req.user;
  try {
    const tables = await tablesCollection
      .find({ brand: user?.brand_id })
      .sort({ table_name: 1 })
      .toArray();
    res.status(200).send({
      success: true,
      message: "Tables retrieved successfully",
      data: tables,
    });
  } catch (error) {
    next(error);
  }
};
