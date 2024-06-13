import createError from "http-errors";
import { ObjectId } from "mongodb";
import { tablesCollection } from "../collections/collections.js";
import { validateString } from "../helpers/validateString.js";
import slugify from "slugify";
import { requiredField } from "../helpers/requiredField.js";
import crypto from "crypto";

export const handleCreateTable = async (req, res, next) => {
  const { table_name } = req.body;
  const { user } = req.user;

  try {
    if (!user) {
      throw createError(401, "User not found. Login Again");
    }
    requiredField(table_name, "Table Name is required");
    const processedTableName = validateString(table_name, "Table Name", 2, 30);

    const existingTable = await tablesCollection.findOne({
      $and: [{ table_name: processedTableName }, { brand: user?.brand_id }],
    });

    if (existingTable) {
      throw createError(400, "Table name already exists");
    }

    const tableSlug = slugify(processedTableName);
    const tableCount = await tablesCollection.countDocuments();
    const generateTableCode = crypto.randomBytes(12).toString("hex");

    const newTable = {
      table_name: processedTableName,
      table_id: tableCount + 1 + "-" + generateTableCode,
      table_slug: tableSlug,
      brand: user?.brand_id,
      createdBy: user?.user_id,
      createdAt: new Date(),
    };

    await tablesCollection.insertOne(newTable);

    res.status(200).send({
      success: true,
      message: "New table created",
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetTables = async (req, res, next) => {
  const { user } = req.user;
  try {
    if (!user) {
      throw createError(401, "User not found. Login Again");
    }
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

export const handleDeleteTable = async (req, res, next) => {
  const { ids } = req.body;

  try {
    if (!Array.isArray(ids)) {
      throw createError("ids must be an array");
    }

    const criteria = { table_id: { $in: ids } };

    const result = await tablesCollection.deleteMany(criteria);
    if (result.deletedCount == 0) {
      throw createError(404, "Document not found for deletion");
    }
    res.status(200).send({
      success: true,
      message: "Table deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleEditTable = async (req, res, next) => {
  const { table_name } = req.body;
  const id = req.params;
  const { user } = req.user;
  try {
    if (!user) {
      throw createError(401, "User not found. Login Again");
    }
    if (!ObjectId.isValid(id)) {
      throw createError(400, "Invalid id");
    }
    requiredField(table_name, "Table Name is required");
    const processedTableName = validateString(table_name, "Table Name", 2, 30);

    const existingTable = await tablesCollection.findOne({
      $and: [{ table_name: processedTableName }, { brand: user?.brand_id }],
    });

    if (existingTable) {
      throw createError(400, "Table name already exists");
    }

    const tableSlug = slugify(processedTableName);

    const editedFields = {
      table_name: processedTableName,
      table_slug: tableSlug,
      updatedBy: user?.user_id,
      updatedAt: new Date(),
    };

    const filter = { _id: new ObjectId(id) };
    const result = await tablesCollection.findOneAndUpdate(filter, {
      $set: editedFields,
    });

    if (!result) {
      throw createError(400, "Table not updated. Try again");
    }
    res.status(200).send({
      success: true,
      message: "Table updated",
    });
  } catch (error) {
    next(error);
  }
};
