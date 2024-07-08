import createError from "http-errors";
import { ObjectId } from "mongodb";
import {
  soldInvoiceCollection,
  staffsCollection,
} from "../collections/collections.js";
import { validateString } from "../helpers/validateString.js";
import { requiredField } from "../helpers/requiredField.js";
import crypto from "crypto";
import validator from "validator";

export const handleCreateStaff = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { name } = req.body;
  try {
    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    requiredField(name, "Name is required");

    const processedName = validateString(name, "Name", 2, 100);

    const existingName = await staffsCollection.findOne({
      $and: [{ brand: user?.brand_id }, { name: processedName }],
    });

    if (existingName) {
      throw createError(400, "Name already exists in this brand");
    }

    const count = await staffsCollection.countDocuments();
    const generateCode = crypto.randomBytes(12).toString("hex");

    const newStaff = {
      staff_id: count + 1 + "-" + generateCode,
      name: processedName,
      brand: user?.brand_id,
      createdBy: user?.user_id,
      createdAt: new Date(),
    };

    await staffsCollection.insertOne(newStaff);

    res.status(200).send({
      success: true,
      message: "New staff created",
      data: newStaff,
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetStaffs = async (req, res, next) => {
  try {
    const user = req.user.user ? req.user.user : req.user;

    if (!user) {
      throw createError(400, "User not found. Login Again");
    }

    const search = req.query.search || "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit);

    const regExSearch = new RegExp(".*" + search + ".*", "i");

    let query;
    if (user?.role == "super admin") {
      if (search) {
        query = {
          $or: [{ name: regExSearch }],
        };
      } else {
        query = {};
      }
    } else {
      if (search) {
        query = {
          $and: [
            {
              brand: user?.brand_id,
            },
          ],
          $or: [{ name: regExSearch }],
        };
      } else {
        query = { brand: user?.brand_id };
      }
    }

    let sortCriteria = { name: 1 };

    const staffs = await staffsCollection
      .find(query)
      .sort(sortCriteria)
      .limit(limit)
      .skip((page - 1) * limit)
      .toArray();

    const count = await staffsCollection.countDocuments(query);

    res.status(200).send({
      success: true,
      message: "Staff retrieved successfully",
      data_found: count,
      pagination: {
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        previousPage: page - 1 > 0 ? page - 1 : null,
        nextPage: page + 1 <= Math.ceil(count / limit) ? page + 1 : null,
      },
      data: staffs,
    });
  } catch (error) {
    next(error);
  }
};

export const handleDeleteStaff = async (req, res, next) => {
  const { ids } = req.body;
  const user = req.user.user ? req.user.user : req.user;
  try {
    if (!user) {
      throw createError(400, "User not found. Please login again");
    }
    if (!Array.isArray(ids)) {
      throw createError("ids must be an array");
    }

    const criteria = { staff_id: { $in: ids } };

    const result = await staffsCollection.deleteMany(criteria);
    if (result.deletedCount == 0) {
      throw createError(404, "Document not found for deletion");
    }
    res.status(200).send({
      success: true,
      message: "Staff deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const handleGetStaffSellRecord = async (req, res, next) => {
  const user = req.user.user ? req.user.user : req.user;
  const { month } = req.params;

  try {
    if (!user) {
      throw createError(400, "User not found. Please login again");
    }

    let query = { brand: user?.brand_id };

    if (month) {
      if (!validator.isISO8601(month, { strict: true })) {
        throw createError(
          400,
          "Invalid month format. Expected format: YYYY-MM"
        );
      }

      const startOfMonth = new Date(month);
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);
      endOfMonth.setUTCDate(0);
      endOfMonth.setUTCHours(23, 59, 59, 999);
      query.createdAt = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const sellReport = await soldInvoiceCollection
      .aggregate([
        { $match: query },
        {
          $project: {
            total_bill: 1,
            served_by: 1,
            createdAt: 1,
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          },
        },
        {
          $group: {
            _id: { day: "$day", served_by: "$served_by" },
            total_bill: { $sum: "$total_bill" },
          },
        },
        {
          $sort: { "_id.day": 1, "_id.served_by": 1 },
        },
        {
          $project: {
            day: "$_id.day",
            served_by: "$_id.served_by",
            total_bill: 1,
            _id: 0,
          },
        },
      ])
      .toArray();

    res.status(200).send({
      success: true,
      message: "Staff sell record retrieved successfully",
      data: sellReport,
    });
  } catch (error) {
    next(error);
  }
};
